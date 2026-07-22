import { useState } from "react";
import { Link } from "react-router-dom";

const API = import.meta.env.VITE_BACKEND_URL || "http://localhost:3001";
const TYPES = ["Normal", "Fire", "Water", "Grass", "Electric", "Ice", "Fighting", "Poison", "Ground", "Flying", "Psychic", "Bug", "Rock", "Ghost", "Dragon", "Dark", "Steel", "Fairy"];

export default function ImportPal() {
  const [file, setFile] = useState(null); const [name, setName] = useState(""); const [primary, setPrimary] = useState("Normal"); const [secondary, setSecondary] = useState(""); const [description, setDescription] = useState(""); const [status, setStatus] = useState(""); const [working, setWorking] = useState(false);
  async function submit(event) {
    event.preventDefault(); setWorking(true); setStatus("");
    try {
      const body = new FormData(); body.append("image", file); body.append("name", name); body.append("type", secondary && secondary !== primary ? `${primary}/${secondary}` : primary); body.append("description", description);
      const response = await fetch(`${API}/api/pokaimon/import`, { method: "POST", body }); const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Import failed");
      setStatus(`${result.name} joined the Gallery with randomized stats and moves.`); setFile(null); setName(""); setDescription("");
    } catch (error) { setStatus(error.message); } finally { setWorking(false); }
  }
  return <section className="cozy-panel p-5 sm:p-7"><p className="cozy-kicker">Bring your own art</p><h2 className="cozy-heading mt-1 text-2xl font-black">Import an existing image</h2><p className="cozy-muted mt-2 text-sm">No AI quota needed. The server assigns stable random stats and a type-based move loadout.</p><form onSubmit={submit} className="mt-5 grid gap-4 sm:grid-cols-2"><label><span className="cozy-label">Image</span><span className="cozy-input flex cursor-pointer items-center justify-center gap-2 overflow-hidden text-center"><span className="rounded-lg px-2 py-1 text-xs font-bold" style={{ background: "var(--accent-soft)", color: "var(--accent-strong)" }}>Choose file</span><span className="cozy-muted min-w-0 truncate text-xs">{file?.name || "No file selected"}</span><input required className="sr-only" type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => setFile(event.target.files?.[0] || null)} /></span></label><label><span className="cozy-label">Name</span><input required minLength={2} maxLength={40} className="cozy-input" value={name} onChange={(event) => setName(event.target.value)} /></label><label><span className="cozy-label">Primary type</span><select className="cozy-input" value={primary} onChange={(event) => setPrimary(event.target.value)}>{TYPES.map((type) => <option key={type}>{type}</option>)}</select></label><label><span className="cozy-label">Secondary type (optional)</span><select className="cozy-input" value={secondary} onChange={(event) => setSecondary(event.target.value)}><option value="">None</option>{TYPES.map((type) => <option key={type}>{type}</option>)}</select></label><label className="sm:col-span-2"><span className="cozy-label">Description (optional)</span><textarea className="cozy-input min-h-24 py-3" maxLength={300} value={description} onChange={(event) => setDescription(event.target.value)} /></label><button type="submit" disabled={working || !file} className="cozy-button cozy-button-primary sm:col-span-2">{working ? "Importing..." : "Add pal to Gallery"}</button></form>{status && <p className="cozy-muted mt-4 text-sm" aria-live="polite">{status} {status.includes("joined") && <Link className="font-bold underline" to="/gallery">View Gallery</Link>}</p>}</section>;
}
