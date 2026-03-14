import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function Landing() {
  const { user } = useAuth();

  return (
    <div className="max-w-2xl mx-auto py-20 px-4 text-center">
      <h1 className="text-5xl font-bold mb-6">GenAI Genesis</h1>
      <p className="text-lg mb-8">
        An AI-native platform for artists. Create, protect, and earn from your art
        in the age of generative AI.
      </p>
      <div className="flex justify-center gap-4">
        <Link
          to="/explore"
          className="border border-black px-6 py-2 hover:bg-gray-100"
        >
          Explore Artists
        </Link>
        {!user && (
          <Link
            to="/signin"
            className="bg-black text-white px-6 py-2 hover:bg-gray-800"
          >
            Get Started
          </Link>
        )}
        {user && (
          <Link
            to="/dashboard"
            className="bg-black text-white px-6 py-2 hover:bg-gray-800"
          >
            Go to Dashboard
          </Link>
        )}
      </div>
    </div>
  );
}
