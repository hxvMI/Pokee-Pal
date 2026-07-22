const STAT_LABELS = {
  attack: "Attack",
  defense: "Defense",
  health: "Health",
  speed: "Speed",
};

function parseCharacteristics(value) {
  if (!value) return { description: "", stats: null };

  let parsed = value;
  if (typeof value === "string") {
    try {
      parsed = JSON.parse(value);
    } catch {
      return { description: value, stats: null };
    }
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return { description: String(value), stats: null };
  }

  const nestedStats = parsed.stats && typeof parsed.stats === "object"
    ? parsed.stats
    : parsed;
  const stats = Object.fromEntries(
    Object.keys(STAT_LABELS)
      .filter((key) => Number.isFinite(Number(nestedStats[key])))
      .map((key) => [key, Number(nestedStats[key])])
  );

  return {
    description:
      typeof parsed.description === "string" && parsed.description.trim()
        ? parsed.description
        : "A spirited arena creature with a distinctive fighting style.",
    stats: Object.keys(stats).length ? stats : null,
  };
}

export default function CreatureDetails({ characteristics, stats: directStats }) {
  const parsed = parseCharacteristics(characteristics);
  const description = parsed.description;
  const stats = directStats && typeof directStats === "object" ? directStats : parsed.stats;

  if (!description && !stats) return null;

  return (
    <div className="mt-3 space-y-3">
      {description && (
        <p className="cozy-muted break-words text-sm leading-relaxed">
          {description}
        </p>
      )}

      {stats && (
        <div className="grid grid-cols-2 gap-x-4 gap-y-2" aria-label="Creature stats">
          {Object.entries(STAT_LABELS).map(([key, label]) => {
            if (stats[key] == null) return null;
            const value = Math.max(0, Math.round(stats[key]));
            const width = Math.min(100, (value / 150) * 100);
            return (
              <div key={key} className="min-w-0">
                <div className="mb-1 flex items-center justify-between gap-2 text-xs">
                  <span className="cozy-muted font-medium">{label}</span>
                  <span className="cozy-heading tabular-nums">{value}</span>
                </div>
                <div className="stat-track h-1.5 overflow-hidden rounded-full">
                  <div
                    className="stat-fill h-full rounded-full"
                    style={{ width: `${width}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
