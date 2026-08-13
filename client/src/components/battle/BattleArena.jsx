import { apiUrl } from "../../utils/api.js";

const imageFor = (pal) => pal?.imageData || (pal?.imageUrl?.startsWith("/") ? apiUrl(pal.imageUrl) : pal?.imageUrl) || apiUrl(pal?.image_url || "");

function Fighter({ pal, turns }) {
  const latest = turns[turns.length - 1];
  const health = latest?.health?.[pal.cardId] ?? pal.stats.health;
  return <div className="min-w-0 text-center"><img src={imageFor(pal)} alt={pal.name} className="mx-auto aspect-square w-full max-w-52 rounded-3xl object-contain" style={{ background: "var(--surface-soft)" }} /><h2 className="cozy-heading mt-3 truncate text-xl font-bold">{pal.name}</h2><p className="cozy-muted text-xs">Level {pal.level}</p><div className="stat-track mx-auto mt-2 h-3 max-w-56 overflow-hidden rounded-full"><div className="h-full rounded-full bg-emerald-500 transition-all duration-500" style={{ width: `${Math.max(0, health / pal.stats.health * 100)}%` }} /></div><p className="cozy-muted mt-1 text-xs">{health} / {pal.stats.health} HP</p></div>;
}

export default function BattleArena({ left, right, turns }) {
  return <section className="cozy-panel p-5 sm:p-8"><p className="cozy-kicker text-center">Battle arena</p><div className="mt-5 grid grid-cols-[1fr_auto_1fr] items-center gap-3"><Fighter pal={left} turns={turns} /><span className="cozy-heading text-xl font-black">VS</span><Fighter pal={right} turns={turns} /></div></section>;
}
