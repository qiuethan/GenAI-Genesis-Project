import { useAuth } from "../context/AuthContext";

export default function Dashboard() {
  const { user, signOut } = useAuth();

  return (
    <div className="min-h-screen bg-white text-black">
      <nav className="border-b border-black px-6 py-4 flex items-center justify-between">
        <h1 className="text-xl font-bold">GenAI Genesis</h1>
        <div className="flex items-center gap-4">
          <span className="text-sm">{user?.email}</span>
          <button
            onClick={signOut}
            className="text-sm underline hover:no-underline"
          >
            Sign Out
          </button>
        </div>
      </nav>
      <main className="max-w-4xl mx-auto py-10 px-4">
        <h2 className="text-2xl font-semibold mb-4">Welcome back!</h2>
        <p>You're signed in. Start generating art or browse artist portfolios.</p>
      </main>
    </div>
  );
}
