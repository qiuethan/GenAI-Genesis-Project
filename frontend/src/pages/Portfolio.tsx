import { useState, useEffect, useRef } from "react";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../lib/supabase";

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
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [artistId, setArtistId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("artists")
      .select("id")
      .eq("user_id", user.id)
      .single()
      .then(({ data, error }) => {
        if (error || !data) {
          setError("No artist profile found. Please create one first.");
          setLoading(false);
          return;
        }
        setArtistId(data.id);
      });
  }, [user]);

  useEffect(() => {
    if (!artistId) return;
    loadArtworks();
  }, [artistId]);

  async function loadArtworks() {
    setLoading(true);
    const { data, error } = await supabase
      .from("artworks")
      .select("*")
      .eq("artist_id", artistId)
      .order("created_at", { ascending: false });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    const works = data || [];
    setArtworks(works);

    // Generate signed URLs for raw images in the private bucket
    const urls: Record<string, string> = {};
    for (const art of works) {
      if (art.protected_image_url) {
        const { data: signed } = await supabase.storage
          .from("artworks-raw")
          .createSignedUrl(art.protected_image_url, 3600);
        if (signed?.signedUrl) {
          urls[art.id] = signed.signedUrl;
        }
      }
    }
    setSignedUrls(urls);
    setLoading(false);
  }

  async function handleUpload() {
    const file = fileRef.current?.files?.[0];
    if (!file || !title.trim() || !artistId) return;

    setUploading(true);
    setError(null);

    const ext = file.name.split(".").pop();
    const path = `${artistId}/${Date.now()}.${ext}`;

    // 1. Upload raw image to private bucket
    const { error: rawError } = await supabase.storage
      .from("artworks-raw")
      .upload(path, file);

    if (rawError) {
      setError(rawError.message);
      setUploading(false);
      return;
    }

    // 2. Upload same image to public bucket as placeholder
    //    (will be replaced with glazed version later)
    const { error: pubError } = await supabase.storage
      .from("artworks-public")
      .upload(path, file);

    if (pubError) {
      setError(pubError.message);
      setUploading(false);
      return;
    }

    const { data: pubUrl } = supabase.storage
      .from("artworks-public")
      .getPublicUrl(path);

    // 3. Create artwork record with both references
    const { error: insertError } = await supabase.from("artworks").insert({
      artist_id: artistId,
      title: title.trim(),
      description: description.trim() || null,
      image_url: pubUrl.publicUrl,
      protected_image_url: path,
      is_public: true,
    });

    if (insertError) {
      setError(insertError.message);
      setUploading(false);
      return;
    }

    setTitle("");
    setDescription("");
    if (fileRef.current) fileRef.current.value = "";
    setUploading(false);
    loadArtworks();
  }

  function getDisplayUrl(art: Artwork): string | null {
    // Show glazed public image if available, fall back to signed raw URL
    return art.image_url || signedUrls[art.id] || null;
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
          {artworks.map((art) => {
            const url = getDisplayUrl(art);
            return (
              <div key={art.id} className="border border-black">
                {url ? (
                  <img
                    src={url}
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
                  <p className="text-xs mt-1">
                    {art.image_url ? "Public (glazed)" : "Pending glazing"}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
