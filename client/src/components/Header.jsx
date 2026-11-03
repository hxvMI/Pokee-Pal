// Shared navigation, theme selection, and session credential controls.
// NavLink determines the active route; contexts supply the settings used across pages.

import { useState } from "react";
import { Link, NavLink } from "react-router-dom";
import { useTheme } from "../context/ThemeContext.jsx";
import { useCloudflareCredentials } from "../context/CloudflareCredentialsContext.jsx";

export default function Header() {
  const { theme, setTheme, themeOptions } = useTheme();
  const { accountId, apiToken, saveCredentials } = useCloudflareCredentials();
  const [accountIdDraft, setAccountIdDraft] = useState(accountId);
  const [apiTokenDraft, setApiTokenDraft] = useState(apiToken);
  const [credentialMessage, setCredentialMessage] = useState("");

  const tabClass = ({ isActive }) =>
    `cozy-tab ${isActive ? "cozy-tab-active" : ""}`;

  function handleCredentialSubmit(event) {
    event.preventDefault();
    if (!/^[a-f0-9]{32}$/i.test(accountIdDraft.trim())) {
      setCredentialMessage("Enter a valid 32-character Account ID.");
      return;
    }
    if (!apiTokenDraft.trim().startsWith("cfut_")) {
      setCredentialMessage("Enter a valid Workers AI token beginning with cfut_.");
      return;
    }
    saveCredentials(accountIdDraft, apiTokenDraft);
    setCredentialMessage("Credentials saved for this browser session.");
  }

  return (
    <header className="site-header sticky top-0 z-50 isolate border-b backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-4 py-3 sm:px-6 lg:px-8">
        <Link to="/" className="brand-lockup mr-auto" aria-label="Pokee-Pal home">
          <span className="brand-mark" aria-hidden="true">P</span>
          <span>
            <span className="brand-title">Pokee-Pal</span>
            <span className="brand-subtitle">Doodles become companions</span>
          </span>
        </Link>

        <nav aria-label="Primary navigation" className="cozy-tab-list order-3 grid w-full grid-cols-4 sm:order-none sm:w-auto">
          <NavLink to="/" end className={tabClass}><span aria-hidden="true">✎</span> Create</NavLink>
          <NavLink to="/gallery" className={tabClass}><span aria-hidden="true">▦</span> Gallery</NavLink>
          <NavLink to="/battle" className={tabClass}><span aria-hidden="true">⚔</span> Battle</NavLink>
          <NavLink to="/customize" className={tabClass}><span aria-hidden="true">✦</span> Customize</NavLink>
        </nav>

        <label className="theme-picker relative z-50">
          <span className="sr-only">Color theme</span>
          <select value={theme} onChange={(event) => setTheme(event.target.value)} aria-label="Color theme">
            {themeOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.icon} {option.label}
              </option>
            ))}
          </select>
        </label>

        <details className="group relative">
          <summary className="credential-trigger" aria-label="Cloudflare API credentials">
            <span aria-hidden="true">⌁</span>
            <span className="hidden lg:inline">API</span>
          </summary>
          <div className="credential-popover absolute right-0 z-30 mt-2 w-[min(24rem,calc(100vw-2rem))] rounded-2xl p-4 shadow-xl">
            <div className="mb-4">
              <h2 className="cozy-heading font-bold">Cloudflare Workers AI</h2>
              <p className="cozy-muted mt-1 text-xs leading-relaxed">
                Saved only for this browser session and sent when generating.
              </p>
            </div>
            <form className="space-y-3" onSubmit={handleCredentialSubmit}>
              <label className="block text-left">
                <span className="cozy-label">Account ID</span>
                <input
                  value={accountIdDraft}
                  onChange={(event) => setAccountIdDraft(event.target.value)}
                  type="text"
                  autoComplete="off"
                  placeholder="32-character account ID"
                  className="cozy-input"
                />
              </label>
              <label className="block text-left">
                <span className="cozy-label">API token</span>
                <input
                  value={apiTokenDraft}
                  onChange={(event) => setApiTokenDraft(event.target.value)}
                  type="password"
                  autoComplete="off"
                  placeholder="cfut_..."
                  className="cozy-input"
                />
              </label>
              <button type="submit" className="cozy-button cozy-button-primary w-full">
                Save for session
              </button>
              {credentialMessage && <p className="cozy-muted text-xs" aria-live="polite">{credentialMessage}</p>}
            </form>
          </div>
        </details>
      </div>
    </header>
  );
}
