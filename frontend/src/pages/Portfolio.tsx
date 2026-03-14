import { useState, useEffect, useRef } from "react";
import { useAuth } from "../context/AuthContext";

interface Artwork {
  id: string;
  title: string;
  description: string | null;
  image_url: string | null;
  protected_image_url: string | null;
  is_public: boolean;
  created_at: string;
}

export default function Portfolio() {
  const { user } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);

  const [artworks, setArtworks] = useState<Artwork[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [artistId, setArtistId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    fetch(`/api/artists/by-user/${user.id}`)
      .then((res) => {
        if (!res.ok) throw new Error("No artist profile found.");
        return res.json();
      })
      .then((data) => setArtistId(data.id))
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, [user]);

  useEffect(() => {
    if (!artistId) return;
    loadArtworks();
  }, [artistId]);

  async function loadArtworks() {
    setLoading(true);
    try {
      const res = await fetch(`/api/artists/${artistId}/artworks`);
      if (!res.ok) throw new Error("Failed to load artworks");
      const data = await res.json();
      setArtworks(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load artworks");
    }
    setLoading(false);
  }

  async function handleUpload() {
    const file = fileRef.current?.files?.[0];
    if (!file || !title.trim() || !artistId) return;

    setUploading(true);
    setError(null);

    const formData = new FormData();
    formData.append("artist_id", artistId);
    formData.append("title", title.trim());
    formData.append("description", description.trim());
    formData.append("file", file);

    try {
      const res = await fetch("/api/artworks/upload", {
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "Upload failed");
      }

      setTitle("");
      setDescription("");
      if (fileRef.current) fileRef.current.value = "";
      loadArtworks();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Upload failed");
    }
    setUploading(false);
  }

  return (
    <div className="max-w-4xl mx-auto py-10 px-4">
      <h1 className="text-3xl font-bold mb-8">My Portfolio</h1>

      {error && (
        <div className="border border-black p-3 text-sm mb-6">{error}</div>
      )}

      {/* Upload form */}
      <div className="border border-black p-6 mb-10">
        <h2 className="text-lg font-semibold mb-4">Upload Artwork</h2>
        <p className="text-xs mb-4">
          Your original is stored privately. A public version will be displayed
          after glazing is applied.
        </p>
        <div className="space-y-3">
          <input
            type="text"
            placeholder="Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full border border-black px-3 py-2 bg-white focus:outline-none"
          />
          <input
            type="text"
            placeholder="Description (optional)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full border border-black px-3 py-2 bg-white focus:outline-none"
          />
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="w-full text-sm"
          />
          <button
            onClick={handleUpload}
            disabled={uploading || !title.trim()}
            className="bg-black text-white px-6 py-2 hover:bg-gray-800 disabled:opacity-50"
          >
            {uploading ? "Uploading..." : "Upload"}
          </button>
        </div>
      </div>

      {/* Gallery */}
      {loading ? (
        <p>Loading...</p>
      ) : artworks.length === 0 ? (
        <p className="text-sm">No artworks yet. Upload your first piece above.</p>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {artworks.map((art) => (
            <div key={art.id} className="border border-black">
              {art.image_url ? (
                <img
                  src={art.image_url}
                  alt={art.title}
                  className="w-full aspect-square object-cover"
                />
              ) : (
                <div className="w-full aspect-square bg-gray-100 flex items-center justify-center text-xs">
                  No preview
                </div>
              )}
              <div className="p-3">
                <p className="font-semibold text-sm">{art.title}</p>
                {art.description && (
                  <p className="text-xs mt-1">{art.description}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
