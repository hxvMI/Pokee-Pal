import { useEffect, useMemo, useState } from "react";
import { usePalGallery } from "../hooks/usePalGallery.js";
import BattleSelector from "../components/battle/BattleSelector.jsx";
import BattleArena from "../components/battle/BattleArena.jsx";
import BattleLog from "../components/battle/BattleLog.jsx";
import BattleResult from "../components/battle/BattleResult.jsx";
import StatAllocator from "../components/battle/StatAllocator.jsx";
import { exportBattleCard, importBattleCard, normalizePortablePal } from "../utils/battleCard.js";
import { apiUrl } from "../utils/api.js";

export default function BattlePage() {
  // This route owns both battle modes: automatic results animate locally,
  // while manual rounds persist on the server under a resumable session ID.
  const { data: pals, loading, error, refetch } = usePalGallery();
  const [leftPalId, setLeftPalId] = useState("");
  const [rightPalId, setRightPalId] = useState("");
  const [leftUpload, setLeftUpload] = useState(null);
  const [rightUpload, setRightUpload] = useState(null);
  const [uploadErrors, setUploadErrors] = useState({});
  const [battleError, setBattleError] = useState("");
  const [result, setResult] = useState(null);
  const [visibleTurnCount, setVisibleTurnCount] = useState(0);
  const [running, setRunning] = useState(false);
  const [savingStats, setSavingStats] = useState(false);
  const [battleMode, setBattleMode] = useState("automatic");
  const [manualSessionId, setManualSessionId] = useState(null);
  const [manualState, setManualState] = useState(null);
  const [manualMoves, setManualMoves] = useState([]);
  const [manualWorking, setManualWorking] = useState(false);

  const leftPal = useMemo(() => leftUpload || (pals.find((pal) => pal.id === Number(leftPalId)) ? normalizePortablePal(pals.find((pal) => pal.id === Number(leftPalId))) : null), [leftUpload, leftPalId, pals]);
  const rightPal = useMemo(() => rightUpload || (pals.find((pal) => pal.id === Number(rightPalId)) ? normalizePortablePal(pals.find((pal) => pal.id === Number(rightPalId))) : null), [rightUpload, rightPalId, pals]);
  const canBattle = leftPal && rightPal && leftPal.cardId !== rightPal.cardId && !running;

  useEffect(() => {
    // Reveal automatic battle events without changing the deterministic result.
    if (!running || !result) return undefined;
    if (visibleTurnCount >= result.log.length) { setRunning(false); return undefined; }
    const timer = window.setTimeout(() => setVisibleTurnCount((count) => count + 1), 450);
    return () => window.clearTimeout(timer);
  }, [running, result, visibleTurnCount]);

  const visibleTurns = useMemo(() => (result?.log || []).slice(0, visibleTurnCount).map((turn) => ({ ...turn, attackerName: turn.attacker === leftPal?.cardId ? leftPal.name : rightPal?.name || "Pokee-Pal" })), [result, visibleTurnCount, leftPal, rightPal]);

  async function uploadCard(side, file) {
    if (!file) return;
    try {
      const card = await importBattleCard(file);
      if (side === "left") { setLeftUpload(card); setLeftPalId(""); }
      else { setRightUpload(card); setRightPalId(""); }
      setUploadErrors((current) => ({ ...current, [side]: "" }));
    } catch (uploadError) {
      setUploadErrors((current) => ({ ...current, [side]: uploadError.message }));
    }
  }

  async function startBattle() {
    if (!canBattle) return;
    setBattleError(""); setResult(null); setVisibleTurnCount(0);
    try {
      const endpoint = battleMode === "manual" ? "/api/battles/manual" : "/api/battles/simulate";
      const response = await fetch(apiUrl(endpoint), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ left: leftPal.id ? { id: leftPal.id } : leftPal, right: rightPal.id ? { id: rightPal.id } : rightPal }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "The battle could not begin.");
      if (battleMode === "manual") { setManualSessionId(data.sessionId); setManualState(data.state); setManualMoves(data.availableMoves); }
      else { setResult(data); setRunning(true); if (data.winner.id) await refetch(); }
    } catch (requestError) { setBattleError(requestError.message); }
  }

  async function playManualMove(move) {
    setManualWorking(true); setBattleError("");
    try {
      const response = await fetch(apiUrl(`/api/battles/${manualSessionId}/action`), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ move: move.name }) });
      const data = await response.json(); if (!response.ok) throw new Error(data.error || "Move failed");
      setManualState(data.state); setManualMoves(data.availableMoves);
      if (data.state.status === "complete") { setResult({ ...data.state, turns: data.state.log.length, levelsGained: 0 }); setVisibleTurnCount(data.state.log.length); await refetch(); }
    } catch (moveError) { setBattleError(moveError.message); } finally { setManualWorking(false); }
  }

  async function saveAllocation(allocations) {
    if (!result?.winner) return;
    setSavingStats(true); setBattleError("");
    try {
      let winner;
      if (result.winner.id) {
        const response = await fetch(apiUrl(`/api/pokaimon/${result.winner.id}/allocate-stats`), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ allocations }) });
        const data = await response.json(); if (!response.ok) throw new Error(data.error || "Could not save stat points."); winner = data; await refetch();
      } else {
        const spent = Object.values(allocations).reduce((sum, value) => sum + value, 0);
        winner = { ...result.winner, stats: Object.fromEntries(Object.entries(result.winner.stats).map(([key, value]) => [key, Math.min(250, value + (allocations[key] || 0))])), unspentStatPoints: result.winner.unspentStatPoints - spent };
      }
      setResult((current) => ({ ...current, winner }));
    } catch (allocationError) { setBattleError(allocationError.message); } finally { setSavingStats(false); }
  }

  function resetBattle() { if (manualSessionId && manualState?.status === "active") fetch(apiUrl(`/api/battles/${manualSessionId}`), { method: "DELETE" }); setResult(null); setVisibleTurnCount(0); setRunning(false); setBattleError(""); setManualSessionId(null); setManualState(null); setManualMoves([]); }

  if (loading) return <p className="cozy-muted text-center">Loading Pokee-Pals...</p>;
  if (error) return <p className="text-center text-red-600">Could not load the gallery.</p>;

  return <div className="mx-auto max-w-6xl space-y-6">
    <section className="cozy-hero overflow-hidden rounded-[2rem] p-7 text-center sm:p-10"><p className="cozy-kicker">Friendly competition</p><h1 className="cozy-heading mt-2 text-4xl font-black">Pokee-Pal Battle Camp</h1><p className="cozy-muted mx-auto mt-3 max-w-2xl">Choose gallery companions or upload shared battle cards, then watch their stats and attacks settle the match.</p></section>

    {!result && !manualState && <section className="cozy-panel p-5 sm:p-8"><div className="mx-auto mb-6 grid max-w-md grid-cols-2 rounded-2xl p-1" style={{ background: "var(--surface-soft)" }}><button type="button" className={`cozy-tab ${battleMode === "automatic" ? "cozy-tab-active" : ""}`} onClick={() => setBattleMode("automatic")}>Automatic</button><button type="button" className={`cozy-tab ${battleMode === "manual" ? "cozy-tab-active" : ""}`} onClick={() => setBattleMode("manual")}>Manual</button></div><div className="grid gap-5 md:grid-cols-2">
      <BattleSelector label="Camp challenger" pals={pals} selectedId={leftPalId} excludedId={rightPalId} onChange={(id) => { setLeftPalId(id); setLeftUpload(null); }} selectedPal={leftPal} onUpload={(file) => uploadCard("left", file)} uploadError={uploadErrors.left} />
      <BattleSelector label="Friendly rival" pals={pals} selectedId={rightPalId} excludedId={leftPalId} onChange={(id) => { setRightPalId(id); setRightUpload(null); }} selectedPal={rightPal} onUpload={(file) => uploadCard("right", file)} uploadError={uploadErrors.right} />
    </div>
      <div className="mt-6 flex flex-wrap justify-center gap-3">{leftPal && <button type="button" className="cozy-button cozy-button-secondary" onClick={() => exportBattleCard(leftPal)}>Download {leftPal.name}</button>}{rightPal && <button type="button" className="cozy-button cozy-button-secondary" onClick={() => exportBattleCard(rightPal)}>Download {rightPal.name}</button>}<button type="button" disabled={!canBattle} className="cozy-button cozy-button-primary" onClick={startBattle}>Start {battleMode === "manual" ? "Manual" : "Automatic"} Battle</button></div>
    </section>}

    {battleError && <p className="rounded-xl bg-red-100 p-3 text-center text-sm text-red-700" role="alert">{battleError}</p>}
    {manualState?.status === "active" && <><BattleArena left={leftPal} right={rightPal} turns={manualState.log} /><BattleLog turns={manualState.log.map((turn) => ({ ...turn, attackerName: turn.attacker === leftPal.cardId ? leftPal.name : rightPal.name }))} running={false} /><section className="cozy-panel p-5"><p className="cozy-kicker">Round {manualState.round}</p><h2 className="cozy-heading mt-1 text-2xl font-bold">Choose {leftPal.name}&apos;s move</h2><div className="mt-4 grid gap-3 sm:grid-cols-2">{manualMoves.map((move) => <button key={move.name} type="button" disabled={manualWorking} onClick={() => playManualMove(move)} className="cozy-button cozy-button-secondary text-left"><strong>{move.name}</strong><span className="cozy-muted mt-1 block text-xs capitalize">{move.kind} · Power {move.power} · {move.accuracy}% accuracy · {move.usesRemaining}/{move.maxUses} uses</span><span className="cozy-muted block text-xs">{move.cooldownRemaining ? `${move.cooldownRemaining} rounds until ready` : "Ready now"}</span></button>)}</div><button type="button" className="cozy-button cozy-button-secondary mt-4" onClick={resetBattle}>Leave battle</button></section></>}
    {result && <><BattleArena left={leftPal} right={rightPal} turns={visibleTurns} /><BattleLog turns={visibleTurns} running={running} onSkip={() => { setVisibleTurnCount(result.log.length); setRunning(false); }} />{!running && <><BattleResult result={result} onRematch={resetBattle} />{result.winner.unspentStatPoints > 0 && <StatAllocator key={`${result.winner.cardId}-${result.winner.unspentStatPoints}`} pal={result.winner} onSave={saveAllocation} saving={savingStats} />}</>}</>}
  </div>;
}
