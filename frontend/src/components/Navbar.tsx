import { useState, useRef, useEffect } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function Navbar() {
  const { user, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <nav className="border-b border-black px-6 py-4 flex items-center justify-between bg-white">
      <div className="flex items-center gap-6">
        <Link to="/" className="text-xl font-bold text-black">
          GenAI Genesis
        </Link>
        <Link to="/explore" className="text-sm text-black hover:underline">
          Explore
        </Link>
        <Link to="/generate" className="text-sm text-black hover:underline">
          Generate
        </Link>
      </div>
      <div className="flex items-center text-sm">
        {user ? (
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setOpen(!open)}
              className="w-8 h-8 rounded-full border border-black flex items-center justify-center hover:bg-gray-100"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="w-4 h-4"
              >
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
            </button>
            {open && (
              <div className="absolute right-0 mt-2 w-44 border border-black bg-white z-10">
                <div className="px-3 py-2 border-b border-black text-xs truncate">
                  {user.email}
                </div>
                <Link
                  to="/dashboard"
                  onClick={() => setOpen(false)}
                  className="block px-3 py-2 hover:bg-gray-100"
                >
                  Dashboard
                </Link>
                <Link
                  to="/portfolio"
                  onClick={() => setOpen(false)}
                  className="block px-3 py-2 hover:bg-gray-100"
                >
                  Portfolio
                </Link>
                <button
                  onClick={() => {
                    setOpen(false);
                    signOut();
                  }}
                  className="w-full text-left px-3 py-2 hover:bg-gray-100"
                >
                  Sign Out
                </button>
              </div>
            )}
          </div>
        ) : (
          <Link to="/signin" className="text-black hover:underline">
            Sign In
          </Link>
        )}
      </div>
    </nav>
  );
}
