// Supabase Edge Function — Deno-Laufzeit.
// Einziger Weg, einen Nutzer-Account zu löschen: auth.admin.deleteUser
// braucht den Service-Role-Key (siehe admin-create-user, gleiches Muster).
// ACHTUNG: owner_id auf objects hat "on delete cascade" (0001_init.sql) —
// das Löschen eines Nutzers löscht unwiderruflich ALLE seine Objekte
// (Dokumente, Projekte, Musik, …). Die Client-UI muss das klar bestätigen
// lassen (siehe Admin.tsx), diese Function verhindert zusätzlich serverseitig
// die Selbstlöschung als letzte Sicherheitsbremse.

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
    return new Response("Nur Admins dürfen Nutzer löschen", { status: 403, headers: corsHeaders });
  }

  const { userId } = await req.json();
  if (!userId) {
    return new Response("userId ist Pflichtfeld", { status: 400, headers: corsHeaders });
  }

  if (userId === user.id) {
    return new Response("Der eigene Account kann nicht gelöscht werden", { status: 400, headers: corsHeaders });
  }

  const serviceClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { error: deleteError } = await serviceClient.auth.admin.deleteUser(userId);
  if (deleteError) {
    return new Response(deleteError.message, { status: 400, headers: corsHeaders });
  }

  return new Response(JSON.stringify({ ok: true }), {
    headers: { ...corsHeaders, "content-type": "application/json" },
  });
});
