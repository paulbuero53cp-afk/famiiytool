import { useAuth } from "./lib/useAuth";
import { Login } from "./components/Login";
import { Shell } from "./components/Shell";

function App() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900 text-slate-400">
        Lädt…
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  return <Shell userId={user.id} />;
}

export default App;
