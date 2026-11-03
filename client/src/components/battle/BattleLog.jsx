// Translate structured battle events into readable messages.
// Support actions, misses, evasion, and damage modifiers each have distinct wording.

function Charges({ turn }) { return turn.usesRemaining < 999 ? <span className="cozy-muted ml-1">({turn.usesRemaining} uses left)</span> : null; }
function TurnMessage({ turn }) {
  if (turn.kind === "heal") return <>{turn.attackerName} used <strong>{turn.move}</strong> and restored <strong className="text-emerald-600">{turn.amount} HP</strong>.<Charges turn={turn} /></>;
  if (turn.kind === "block") return <>{turn.attackerName} used <strong>{turn.move}</strong> and prepared a <strong>{turn.amount}-point shield</strong>.<Charges turn={turn} /></>;
  if (turn.kind === "reflect") return <>{turn.attackerName} used <strong>{turn.move}</strong> and will reflect <strong>{turn.amount}%</strong> of the next hit.<Charges turn={turn} /></>;
  if (turn.missed) return <>{turn.attackerName} used <strong>{turn.move}</strong>, but it <strong className="text-amber-600">missed!</strong><Charges turn={turn} /></>;
  if (turn.evaded) return <>{turn.attackerName} used <strong>{turn.move}</strong>, but the attack was <strong className="text-sky-600">evaded!</strong><Charges turn={turn} /></>;
  return <>{turn.attackerName} used <strong>{turn.move}</strong> <span className="cozy-muted">({turn.moveType} · {turn.moveTier})</span> for {turn.damage} damage.<Charges turn={turn} />{turn.critical && <strong className="ml-1 text-rose-600">Critical hit!</strong>}{turn.blocked > 0 && <strong className="ml-1 text-sky-600">Blocked {turn.blocked}!</strong>}{turn.reflected > 0 && <strong className="ml-1 text-violet-600">Reflected {turn.reflected}!</strong>}{turn.drained > 0 && <strong className="ml-1 text-emerald-600">Drained {turn.drained} HP!</strong>}{turn.recoil > 0 && <strong className="ml-1 text-orange-600">Took {turn.recoil} recoil!</strong>}{turn.pierced > 0 && <span className="cozy-muted ml-1">Pierced defense.</span>}{turn.executeBoosted && <strong className="ml-1 text-fuchsia-600">Finisher bonus!</strong>}{turn.effectiveness > 1 && <strong className="ml-1 text-emerald-600">Super effective!</strong>}{turn.effectiveness > 0 && turn.effectiveness < 1 && <span className="cozy-muted ml-1">Not very effective.</span>}{turn.effectiveness === 0 && <strong className="ml-1 text-amber-600">No effect!</strong>}</>;
}

export default function BattleLog({ turns, running, onSkip }) {
  return <section className="cozy-panel p-5"><div className="flex items-center justify-between"><h2 className="cozy-heading text-xl font-bold">Battle story</h2>{running && <button className="cozy-button cozy-button-secondary" type="button" onClick={onSkip}>Skip animation</button>}</div><ol className="mt-4 max-h-72 space-y-2 overflow-y-auto" aria-live="polite">{turns.map((turn) => <li key={turn.turn} className="rounded-xl p-3 text-sm" style={{ background: "var(--surface-soft)" }}><strong>Turn {turn.turn}:</strong> <TurnMessage turn={turn} /></li>)}</ol></section>;
}
