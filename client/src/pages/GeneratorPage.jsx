import { useState } from "react";
import Canvas from "../components/Canvas.jsx";
import Spinner from "../components/Spinner.jsx";
import CreatureDetails from "../components/CreatureDetails.jsx";
import { useCloudflareCredentials } from "../context/CloudflareCredentialsContext.jsx";
import ImportPal from "../components/ImportPal.jsx";

const API = import.meta.env.VITE_BACKEND_URL || "http://localhost:3001";

export default function GeneratorPage() {
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState(null);
  const [lastResult, setLastResult] = useState(null);
  const { accountId, apiToken } = useCloudflareCredentials();
  const [nameDraft, setNameDraft] = useState("");
  const [isRenaming, setIsRenaming] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);

  const handleGenerate = async (base64, palStyle) => {
    try {
      setIsGenerating(true);
      setError(null);
      if (!accountId || !apiToken) {
        throw new Error("Save your Cloudflare Account ID and API token first.");
      }
      const res = await fetch(`${API}/api/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          doodle_data: base64,
          cloudflare_account_id: accountId,
          cloudflare_api_token: apiToken,
          pal_style: palStyle,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Failed to generate Pokee-Pal");
      setLastResult(json);
      setNameDraft(json.name);
    } catch (generationError) {
      setError(generationError.message);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleRename = async () => {
    if (!lastResult?.id) return;
    try {
      setIsRenaming(true); setError(null);
      const res = await fetch(`${API}/api/pokaimon/${lastResult.id}/name`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: nameDraft }) });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to rename Pokee-Pal");
      setLastResult(json); setNameDraft(json.name); setIsEditingName(false);
    } catch (renameError) { setError(renameError.message); } finally { setIsRenaming(false); }
  };

  return (
    <div className="space-y-7">
      <section className="cozy-hero overflow-hidden rounded-[2rem] px-6 py-8 sm:px-10 sm:py-10">
        <div className="relative z-10 max-w-2xl">
          <p className="cozy-kicker">Welcome to the workshop</p>
          <h1 className="cozy-heading mt-2 text-4xl font-black leading-tight sm:text-5xl">
            Draw a little idea.<br />Meet a new best pal.
          </h1>
          <p className="cozy-muted mt-4 max-w-xl text-base leading-relaxed sm:text-lg">
            Give us your scribble and we’ll turn it into a one-of-a-kind Pokee-Pal,
            complete with a name, personality, powers, and stats.
          </p>
        </div>
        <div className="cozy-hero-orb cozy-hero-orb-one" />
        <div className="cozy-hero-orb cozy-hero-orb-two" />
      </section>

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-2 lg:gap-8">
        <Canvas onGenerate={handleGenerate} disabled={isGenerating} />

        <section className="cozy-panel flex flex-col p-4 sm:p-6">
          <div className="mb-5 flex items-start justify-between gap-4">
            <div>
              <p className="cozy-kicker">Step two</p>
              <h2 className="cozy-heading mt-1 text-2xl font-black">Your new Pokee-Pal</h2>
              <p className="cozy-muted mt-1 text-sm">Fresh from the imagination workshop.</p>
            </div>
            <span className="cozy-step-badge" aria-hidden="true">♥</span>
          </div>

          <div className="result-frame relative flex aspect-square w-full items-center justify-center overflow-hidden rounded-2xl p-3">
            {!lastResult && !isGenerating && (
              <div className="max-w-xs px-6 text-center">
                <div className="empty-nest mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full text-4xl">✦</div>
                <p className="cozy-heading text-lg font-bold">A cozy spot is waiting</p>
                <p className="cozy-muted mt-2 text-sm leading-relaxed">
                  Your generated Pokee-Pal will curl up right here.
                </p>
              </div>
            )}
            {isGenerating && <Spinner label="Bringing your Pokee-Pal to life…" />}
            {lastResult && !isGenerating && (
              <img
                src={`${API}${lastResult.image_url}`}
                alt={lastResult.name}
                className="h-full w-full rounded-xl object-contain"
              />
            )}
          </div>

          {error && (
            <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
              {error}
            </div>
          )}

          {lastResult && (
            <div className="result-card mt-4 rounded-2xl p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                {isEditingName ? <div className="flex min-w-0 flex-1 items-center gap-2"><input className="cozy-input" value={nameDraft} maxLength={40} onChange={(event) => setNameDraft(event.target.value)} aria-label="New Pokee-Pal name" autoFocus /><button type="button" className="cozy-button cozy-button-primary" disabled={isRenaming || nameDraft.trim() === lastResult.name} onClick={handleRename}>{isRenaming ? "..." : "Save"}</button><button type="button" className="cozy-button cozy-button-secondary" onClick={() => { setNameDraft(lastResult.name); setIsEditingName(false); }}>Cancel</button></div> : <div className="flex min-w-0 items-center gap-2"><h3 className="cozy-heading truncate text-2xl font-black">{lastResult.name}</h3><button type="button" className="rename-pencil" onClick={() => setIsEditingName(true)} aria-label={`Rename ${lastResult.name}`} title="Rename pal">✏️</button></div>}
                {lastResult.type && <span className="type-badge">{lastResult.type}</span>}
              </div>
              <CreatureDetails characteristics={lastResult.characteristics} stats={lastResult.stats} />
            </div>
          )}
        </section>
      </div>
      <ImportPal />
    </div>
  );
}
