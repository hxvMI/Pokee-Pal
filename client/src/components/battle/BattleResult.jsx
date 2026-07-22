import { exportBattleCard } from "../../utils/battleCard.js";
export default function BattleResult({ result, onRematch }) {
  return <section className="cozy-panel p-6 text-center"><p className="cozy-kicker">Winner</p><h2 className="cozy-heading mt-2 text-3xl font-black">{result.winner.name}</h2>
    <p className="cozy-muted mt-2">{result.rematch ? "Rematch — no XP awarded." : `Earned ${result.xpAwarded} XP.`}{result.levelsGained > 0 && ` Leveled up ${result.levelsGained} time${result.levelsGained > 1 ? "s" : ""}!`}</p>
    {result.summary && <div className="mx-auto mt-5 grid max-w-2xl gap-3 text-left sm:grid-cols-2">{[result.winner, result.loser].map((pal) => { const stats = result.summary[pal.cardId]; return <div key={pal.cardId} className="rounded-2xl p-4" style={{ background: "var(--surface-soft)" }}><h3 className="cozy-heading font-bold">{pal.name}</h3><p className="cozy-muted mt-2 text-xs leading-5">{stats.damage} damage · {stats.healing} healed<br />{stats.blocked} blocked · {stats.reflected} reflected<br />{stats.evasions} evasions · {stats.criticals} criticals</p></div>; })}</div>}
    <div className="mt-5 flex flex-wrap justify-center gap-3"><button type="button" className="cozy-button cozy-button-primary" onClick={() => exportBattleCard(result.winner)}>Download winner card</button><button type="button" className="cozy-button cozy-button-secondary" onClick={onRematch}>New battle</button></div>
  </section>;
}
