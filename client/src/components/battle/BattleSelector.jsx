// Choose a gallery pal or upload a portable PNG for one side of a battle.
// The parent owns selection state and import errors; this component presents those values.

import { apiUrl } from "../../utils/api.js";

// Imported object URLs take priority; stored relative paths use the configured API origin.
function imageFor(pal) {
  if (pal.imageData) return pal.imageData;
  const path = pal.image_url || pal.imageUrl || "";
  return path.startsWith("/") ? apiUrl(path) : path;
}

export default function BattleSelector({ label, pals, selectedId, excludedId, onChange, selectedPal, onUpload, uploadError }) {
  return <div className="battle-slot text-left">
    <span className="cozy-label">{label}</span>
    <select className="cozy-input" value={selectedId} onChange={(event) => onChange(event.target.value)}>
      <option value="">Choose a Pokee-Pal</option>
      {pals.map((pal) => <option key={pal.id} value={pal.id} disabled={pal.id === Number(excludedId)}>{pal.name} — Level {pal.level}</option>)}
    </select>
    <div className="my-3 flex items-center gap-2"><span className="h-px flex-1 bg-current opacity-10" /><span className="cozy-muted text-xs">or share a card</span><span className="h-px flex-1 bg-current opacity-10" /></div>
    <label className="cozy-button cozy-button-secondary block cursor-pointer text-center">Upload battle-card PNG<input className="sr-only" type="file" accept="image/png" onChange={(event) => onUpload(event.target.files?.[0])} /></label>
    {uploadError && <p className="mt-2 text-xs text-red-600">{uploadError}</p>}
    {selectedPal && <div className="mt-4 rounded-2xl p-3" style={{ background: "var(--surface-soft)" }}>
      <img src={imageFor(selectedPal)} alt={selectedPal.name} className="h-56 w-full rounded-2xl object-contain sm:h-64" />
      <div className="mt-3 min-w-0 text-center"><p className="cozy-heading truncate text-xl font-bold">{selectedPal.name}</p><p className="cozy-muted text-sm">Level {selectedPal.level || 1} · {selectedPal.type}</p>{selectedPal.imported && <span className="mt-2 inline-block rounded-full bg-amber-100 px-2 py-1 text-[10px] font-bold text-amber-800">Unverified shared card</span>}</div>
    </div>}
  </div>;
}
