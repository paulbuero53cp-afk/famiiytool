// Supabase Edge Function — Deno-Laufzeit.
// Einziger Weg, direkt einen Nutzer-Account anzulegen: auth.admin.createUser
// braucht den Service-Role-Key und darf NIE vom Client aus aufgerufen werden
// (siehe CLAUDE.md, Sicherheitsregeln). Nur für Admins — Rollen-Check über
// die bestehende SECURITY-DEFINER-Funktion is_current_user_admin()
// (siehe 0009_admin_panel.sql). email_confirm: true, da der Admin die
// E-Mail-Adresse bereits selbst geprüft eingibt — kein Bestätigungslink
// nötig, der Account ist sofort nutzbar. Der bestehende Trigger
// handle_new_user (0007_sharing.sql) legt automatisch die profiles-Zeile an.

import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405, headers: corsHeaders });
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response("Unauthorized", { status: 401, headers: corsHeaders });
  }

  const userClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );

  const {
    data: { user },
    error: userError,
  } = await userClient.auth.getUser();

  if (userError || !user) {
    return new Response("Unauthorized", { status: 401, headers: corsHeaders });
  }

  const { data: isAdmin, error: adminCheckError } = await userClient.rpc("is_current_user_admin");
  if (adminCheckError || !isAdmin) {
    return new Response("Nur Admins dürfen Nutzer anlegen", { status: 403, headers: corsHeaders });
  }

  const { email, password } = await req.json();
  if (!email || !password) {
    return new Response("email und password sind Pflichtfelder", { status: 400, headers: corsHeaders });
  }

  const serviceClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data: created, error: createError } = await serviceClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (createError) {
    return new Response(createError.message, { status: 400, headers: corsHeaders });
  }

  return new Response(JSON.stringify({ userId: created.user?.id }), {
    headers: { ...corsHeaders, "content-type": "application/json" },
  });
});
