import { useAuth } from "../context/AuthContext";

export default function Dashboard() {
  const { user } = useAuth();

  return (
    <main className="max-w-4xl mx-auto py-10 px-4">
      <h2 className="text-2xl font-semibold mb-4">Welcome back!</h2>
      <p>Signed in as {user?.email}. Start generating art or browse artist portfolios.</p>
    </main>
  );
}
