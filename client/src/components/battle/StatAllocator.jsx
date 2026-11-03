// Stage stat increases locally before submitting them through onSave.
// Remaining points guide the UI; persisted allocations are validated by the server.

import { useState } from "react";

const KEYS = ["attack", "defense", "health", "speed"];
export default function StatAllocator({ pal, onSave, saving }) {
  const [allocations, setAllocations] = useState({ attack: 0, defense: 0, health: 0, speed: 0 });
  const spent = Object.values(allocations).reduce((sum, value) => sum + value, 0);
  const remaining = pal.unspentStatPoints - spent;
  const change = (key, amount) => setAllocations((current) => ({ ...current, [key]: Math.max(0, current[key] + amount) }));
  return <section className="cozy-panel p-5"><h2 className="cozy-heading text-xl font-bold">Spend stat points</h2><p className="cozy-muted text-sm">{remaining} points remaining</p>
    <div className="mt-4 grid gap-3 sm:grid-cols-2">{KEYS.map((key) => <div key={key} className="flex items-center justify-between rounded-xl p-3" style={{ background: "var(--surface-soft)" }}><span className="capitalize">{key}: {pal.stats[key]} <strong>+{allocations[key]}</strong></span><div><button type="button" className="px-2" onClick={() => change(key, -1)} disabled={!allocations[key]}>−</button><button type="button" className="px-2" onClick={() => remaining > 0 && pal.stats[key] + allocations[key] < 250 && change(key, 1)} disabled={remaining <= 0}>+</button></div></div>)}</div>
    <button type="button" className="cozy-button cozy-button-primary mt-4" disabled={!spent || saving} onClick={() => onSave(allocations)}>Save allocation</button>
  </section>;
}
