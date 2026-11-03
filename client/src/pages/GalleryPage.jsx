// Display saved creatures with local sorting, type filtering, and editing controls.
// Mutation handlers update the visible collection after successful API responses.

import Spinner from "../components/Spinner.jsx";
import { useState, useMemo } from "react";
import { usePalGallery } from "../hooks/usePalGallery.js";
import CreatureDetails from "../components/CreatureDetails.jsx";
import { Link } from "react-router-dom";
import { apiUrl } from "../utils/api.js";

export default function GalleryPage() {
  // Gallery state comes from the shared hook; derived sorting and filtering
  // remain local so server data stays canonical after mutations.
  const { data, loading, error, setData } = usePalGallery();
  const [sortBy, setSortBy] = useState("newest");
  const [filterType, setFilterType] = useState("all");
  const [editingId, setEditingId] = useState(null);
  const [nameDraft, setNameDraft] = useState("");
  const [renameError, setRenameError] = useState("");
  const [pendingDeleteId, setPendingDeleteId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  // Copy the collection before sorting so display changes do not mutate hook state.
  // The default order is the newest-first order returned by the API.
  const processedData = useMemo(() => {
    let result = [...data];

    // filter by type
    if (filterType !== "all"){
      result = result.filter((p) => String(p.type || "").split("/")
        .some((type) => type.trim().toLowerCase() === filterType));
    }

    switch (sortBy) {
      case "likes":
        result.sort((a, b) => (b.like_count || 0) - (a.like_count || 0));
        break;
        case "name":
          result.sort((a, b) => a.name.localeCompare(b.name));
          break;
        case "newest":
        default:
          break;
    }

    return result;
  }, [data, sortBy, filterType]);

  // Split dual types into individual options and remove duplicate entries.
  const availableTypes = useMemo(() => {
    const types = new Set(data.flatMap((p) => String(p.type || "").split("/"))
      .map((type) => type.trim()).filter(Boolean));
    return Array.from(types).sort((a, b) => a.localeCompare(b));
  }, [data]);

  const like = async (id) => {
    try {
      const res = await fetch(apiUrl(`/api/pokaimon/${id}/like`), {
        method: "PATCH",
      });
      if (!res.ok) throw new Error("Failed to like");

      // Update like count locally without refetching
      setData(data.map(p => p.id === id ? { ...p, like_count: (p.like_count || 0) + 1 } : p));
    } catch (e) {
      console.error(e);
    }
  };

  // Remove a card from local state only after the server confirms deletion.
  const removePal = async (pal) => {
    try {
      setDeletingId(pal.id);
      const res = await fetch(apiUrl(`/api/pokaimon/${pal.id}`), { method: "DELETE" });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Failed to delete");
      setData(data.filter((item) => item.id !== pal.id));
      setPendingDeleteId(null);
    } catch (deleteError) {
      setRenameError(deleteError.message);
    } finally { setDeletingId(null); }
  };

  const rename = async (id) => {
    try {
      setRenameError("");
      const res = await fetch(apiUrl(`/api/pokaimon/${id}/name`), { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: nameDraft }) });
      const updated = await res.json();
      if (!res.ok) throw new Error(updated.error || "Failed to rename");
      setData(data.map((pal) => pal.id === id ? { ...pal, ...updated, attacks: pal.attacks } : pal));
      setEditingId(null);
    } catch (renameFailure) { setRenameError(renameFailure.message); }
  };

  if (loading) return <Spinner label="Loading gallery…" />;
  if (error)
    return (
      <div className="text-red-500 dark:text-red-400">
        Failed to load: {String(error)}
      </div>
    );

  return (
    <div>
      <section className="mx-auto mb-8 max-w-2xl rounded-2xl border border-gray-200 bg-white/90 p-5 text-center shadow-sm backdrop-blur dark:border-gray-700 dark:bg-gray-800/90 sm:p-6">
        <div className="mx-auto mb-5 flex w-fit items-center gap-3">
          <span
            aria-hidden="true"
            className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-100 text-xl text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300"
          >
            ▦
          </span>
          <div className="text-left">
            <h2 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
              Pokee-Pal Gallery
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Browse, filter, and find your favorite creations.
            </p>
          </div>
        </div>

        <div className="flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-end">
          <label className="flex min-w-44 flex-col gap-1.5 text-left">
            <span className="pl-1 text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
              Sort by
            </span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="h-11 cursor-pointer rounded-xl border border-gray-200 bg-gray-50 px-4 text-sm font-semibold text-gray-800 outline-none transition hover:border-indigo-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100 dark:hover:border-indigo-500"
            >
              <option value="newest">Newest first</option>
              <option value="likes">Most liked</option>
              <option value="name">Name A–Z</option>
            </select>
          </label>

          {availableTypes.length > 0 && (
            <label className="flex min-w-44 flex-col gap-1.5 text-left">
              <span className="pl-1 text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                Creature type
              </span>
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="h-11 cursor-pointer rounded-xl border border-gray-200 bg-gray-50 px-4 text-sm font-semibold text-gray-800 outline-none transition hover:border-indigo-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100 dark:hover:border-indigo-500"
              >
                <option value="all">All types</option>
                {availableTypes.map((type) => (
                  <option key={type} value={type.toLowerCase()}>
                    {type}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
      </section>

      {processedData.length === 0 ? (
        <p className="text-gray-600 dark:text-gray-400">
          {data.length === 0
            ? "No generated Pokee-Pal yet. Head to the Generator!"
            : "No Pokee-Pals match this creature type."}
        </p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {
  processedData.map((p) => (
    <div key={p.id} className="bg-white dark:bg-gray-800 rounded-xl shadow p-4">
      <img
        src={apiUrl(p.image_url)}
        alt={p.name}
        className="w-full aspect-square object-contain"
      />
      {editingId === p.id ? <div className="mt-3 flex items-center gap-2"><input className="cozy-input" value={nameDraft} maxLength={40} onChange={(event) => setNameDraft(event.target.value)} aria-label={`New name for ${p.name}`} autoFocus /><button type="button" className="cozy-button cozy-button-primary" onClick={() => rename(p.id)}>Save</button><button type="button" className="cozy-button cozy-button-secondary" onClick={() => setEditingId(null)}>Cancel</button></div> : <div className="mt-3 flex min-w-0 items-center gap-2"><h3 className="truncate text-xl font-semibold text-gray-900 dark:text-white">{p.name}</h3><button type="button" className="rename-pencil" onClick={() => { setEditingId(p.id); setNameDraft(p.name); setRenameError(""); }} aria-label={`Rename ${p.name}`} title="Rename pal">✏️</button></div>}
      {editingId === p.id && renameError && <p className="mt-1 text-xs text-red-600">{renameError}</p>}
      {p.type && (
        <span className="inline-block mt-2 text-xs px-2 py-1 rounded bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-200">
          {p.type}
        </span>
      )}
      <div className="mt-2 flex items-center justify-between gap-2"><span className="font-bold text-amber-500" aria-label={`${p.starLevel || 1} stars`}>{"★".repeat(p.starLevel || 1)}</span><Link to="/customize" className="cozy-muted text-xs font-bold underline">Customize</Link></div>
      <CreatureDetails characteristics={p.characteristics} stats={p.stats} />
      <div className="mt-4">
        <div className="mb-1 flex items-center justify-between text-xs"><span className="font-bold text-gray-700 dark:text-gray-200">Level {p.level || 1}/5</span><span className="text-gray-500 dark:text-gray-400">{p.level >= 5 ? "Ready to evolve" : `${p.xp || 0} / ${(p.level || 1) * 100} XP`}</span></div>
        <div className="stat-track h-2.5 overflow-hidden rounded-full" role="progressbar" aria-label={`${p.name} experience`} aria-valuemin="0" aria-valuemax={(p.level || 1) * 100} aria-valuenow={p.level >= 5 ? (p.level || 1) * 100 : p.xp || 0}><div className="h-full rounded-full bg-gradient-to-r from-amber-400 to-orange-500 transition-all" style={{ width: `${p.level >= 5 ? 100 : Math.min(100, ((p.xp || 0) / ((p.level || 1) * 100)) * 100)}%` }} /></div>
      </div>
      {Array.isArray(p.attacks) && p.attacks.length > 0 && <div className="mt-4 space-y-2"><p className="text-xs font-bold uppercase tracking-wider text-gray-600 dark:text-gray-300">Battle moves</p>{p.attacks.map((move) => {
        const labels = { attack: "Attack", block: "Guard", heal: "Heal", reflect: "Reflect" };
        const colors = { attack: "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300", block: "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300", heal: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300", reflect: "bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300" };
        return <div key={move.name} className="rounded-xl border border-gray-100 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-900/60"><div className="flex flex-wrap items-center gap-2"><span className={`rounded-full px-2 py-1 text-[10px] font-black uppercase ${colors[move.kind] || colors.attack}`}>{labels[move.kind] || "Attack"}</span><strong className="min-w-0 flex-1 text-sm text-gray-900 dark:text-white">{move.name}</strong></div><p className="mt-2 text-xs leading-relaxed text-gray-600 dark:text-gray-400">{move.description}</p><div className="mt-2 flex flex-wrap gap-3 text-[10px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">{move.kind === "attack" && <span>{move.tier} · Power {move.power}</span>}<span>{move.maxUses} uses</span>{move.cooldown > 0 && <span>{move.cooldown}-turn cooldown</span>}<span>{move.type}</span></div></div>;
      })}</div>}
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          like(p.id);
        }}
        className="mt-3 w-full px-3 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
      >
        👍 Like ({p.like_count || 0})
      </button>
      {pendingDeleteId === p.id ? <div className="mt-2 rounded-xl border border-red-200 bg-red-50 p-3 text-center dark:border-red-900 dark:bg-red-950/30"><p className="text-xs font-semibold text-red-700 dark:text-red-300">Delete {p.name}? This cannot be undone.</p><div className="mt-2 flex gap-2"><button type="button" onClick={() => removePal(p)} disabled={deletingId === p.id} className="cozy-button flex-1 bg-red-600 text-white">{deletingId === p.id ? "Deleting..." : "Confirm delete"}</button><button type="button" onClick={() => setPendingDeleteId(null)} disabled={deletingId === p.id} className="cozy-button cozy-button-secondary flex-1">Cancel</button></div></div> : <button type="button" onClick={() => { setPendingDeleteId(p.id); setRenameError(""); }} className="mt-2 w-full rounded-md border border-red-200 px-3 py-2 text-sm font-semibold text-red-600 transition hover:bg-red-50 dark:border-red-900 dark:text-red-300 dark:hover:bg-red-950/40" aria-label={`Delete ${p.name}`}>🗑️ Delete</button>}
      {pendingDeleteId === p.id && renameError && <p className="mt-1 text-xs text-red-600">{renameError}</p>}
    </div>
  ))}
        </div>
      )}
    </div>
  );
}
