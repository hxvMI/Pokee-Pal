import { apiUrl } from "./api.js";

const FORMAT = "pokee-pal-card";
const VERSION = 2;
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const encoder = new TextEncoder();
const decoder = new TextDecoder();

const clamp = (value, min, max, fallback) => {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(min, Math.min(max, Math.round(number))) : fallback;
};

function parseCharacteristics(value) {
  if (!value) return { description: "", stats: null };
  if (typeof value === "object") return { description: value.description || "", stats: value.stats || value };
  try {
    const parsed = JSON.parse(value);
    return { description: parsed.description || "", stats: parsed.stats || parsed };
  } catch {
    return { description: String(value), stats: null };
  }
}

export function normalizePortablePal(data, { imported = false } = {}) {
  // Normalize database rows and uploaded card versions into one bounded battle
  // model before any untrusted values reach simulation or rendering code.
  if (!data || typeof data !== "object") throw new Error("The card does not contain valid Pokee-Pal data.");
  const legacy = parseCharacteristics(data.characteristics);
  const rawStats = data.stats || legacy.stats || {};
  const stats = Object.fromEntries(["attack", "defense", "health", "speed"].map((key) => [key, clamp(rawStats[key], 1, 250, key === "health" ? 100 : 75)]));
  const sourceAttacks = data.equippedMoves || data.equipped_moves || data.attacks || data.unlocked_attacks || data.powers || [];
  const attacks = (Array.isArray(sourceAttacks) ? sourceAttacks : []).slice(0, 12).map((attack, index) => ({
    name: String(attack?.name || `Doodle Move ${index + 1}`).slice(0, 60),
    description: String(attack?.description || "A spirited doodle-powered move.").slice(0, 240),
    power: clamp(attack?.power, 1, 150, 35), unlockLevel: clamp(attack?.unlockLevel, 1, 99, 1), unlockStar: clamp(attack?.unlockStar, 1, 5, 1), type: String(attack?.type || data.type || "Normal").split("/")[0],
    kind: ["attack", "heal", "block", "reflect"].includes(attack?.kind) ? attack.kind : "attack",
    cooldown: clamp(attack?.cooldown, 0, 20, attack?.kind && attack.kind !== "attack" ? 5 : 0),
    maxUses: attack?.kind === "reflect" ? 1 : attack?.kind === "heal" || attack?.kind === "block" ? 2 : Number(attack?.power) >= 85 ? 4 : Number(attack?.power) >= 65 ? 6 : 8,
    tier: attack?.kind && attack.kind !== "attack" ? "support" : String(attack?.tier || (Number(attack?.power) >= 85 ? "heavy" : Number(attack?.power) >= 65 ? "medium" : "light")),
    accuracy: clamp(attack?.accuracy, 25, 100, 100), recoilPercent: clamp(attack?.recoilPercent, 0, 50, 0),
    drainPercent: clamp(attack?.drainPercent, 0, 50, 0), piercePercent: clamp(attack?.piercePercent, 0, 50, 0),
    executeBonus: clamp(attack?.executeBonus, 0, 100, 0), critBonus: Math.max(0, Math.min(0.5, Number(attack?.critBonus) || 0)),
  }));
  const starLevel = clamp(data.starLevel ?? data.star_level, 1, 5, 1);
  const unlockedMovesSource = data.unlockedMoves || data.unlocked_moves || sourceAttacks;
  const unlockedMoves = (Array.isArray(unlockedMovesSource) ? unlockedMovesSource : []).slice(0, 40).map((move, index) => attacks.find((attack) => attack.name === move.name) || { ...move, name: String(move?.name || `Move ${index + 1}`) });
  const achievements = data.achievements && typeof data.achievements === "object" ? data.achievements : {};
  const unlockedFrames = Array.isArray(data.unlockedFrames || data.unlocked_frames) ? (data.unlockedFrames || data.unlocked_frames) : ["starter-linen"];
  return {
    format: FORMAT, version: VERSION, id: data.id ? Number(data.id) : undefined,
    cardId: String(data.cardId || data.card_id || crypto.randomUUID()),
    name: String(data.name || "Mystery Pal").slice(0, 100), type: String(data.type || "Normal").slice(0, 100),
    description: String(data.description || legacy.description || "A spirited arena companion.").slice(0, 300),
    sourceType: data.sourceType || data.source_type || (imported ? "shared" : "generated"), starLevel,
    level: clamp(data.level, 1, 5, 1), xp: clamp(data.xp, 0, 1000000, 0),
    unspentStatPoints: clamp(data.unspentStatPoints ?? data.unspent_stat_points, 0, 10000, 0),
    stats, attacks: attacks.length ? attacks.slice(0, 4) : [{ name: "Doodle Dash", description: "Rushes ahead in a trail of ink.", power: 35, unlockLevel: 1 }],
    equippedMoves: attacks.slice(0, 4), unlockedMoves, selectedFrame: unlockedFrames.includes(data.selectedFrame || data.selected_frame) ? (data.selectedFrame || data.selected_frame) : "starter-linen", unlockedFrames, achievements,
    battleRecord: data.battleRecord || data.battle_record || { wins: 0, losses: 0 },
    imageUrl: data.imageUrl || data.image_url || "", imageData: data.imageData || "", imported,
  };
}

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function makeChunk(type, data) {
  const typeBytes = encoder.encode(type);
  const output = new Uint8Array(12 + data.length);
  const view = new DataView(output.buffer);
  view.setUint32(0, data.length);
  output.set(typeBytes, 4); output.set(data, 8);
  view.setUint32(8 + data.length, crc32(new Uint8Array([...typeBytes, ...data])));
  return output;
}

function insertMetadata(png, payload) {
  // Portable cards remain valid PNGs: metadata is inserted before IEND so
  // ordinary image viewers and Pokee-Pal can share the same file.
  const keyword = encoder.encode(FORMAT);
  const json = encoder.encode(JSON.stringify(payload));
  const data = new Uint8Array(keyword.length + 5 + json.length);
  data.set(keyword); // keyword + null, compression flag, compression method, language null, translated keyword null
  data.set(json, keyword.length + 5);
  const chunk = makeChunk("iTXt", data);
  let offset = 8;
  while (offset < png.length) {
    const length = new DataView(png.buffer, png.byteOffset + offset, 4).getUint32(0);
    const type = decoder.decode(png.slice(offset + 4, offset + 8));
    if (type === "IEND") return new Uint8Array([...png.slice(0, offset), ...chunk, ...png.slice(offset)]);
    offset += length + 12;
  }
  throw new Error("Could not write card metadata.");
}

function readMetadata(bytes) {
  let offset = 8;
  while (offset + 12 <= bytes.length) {
    const length = new DataView(bytes.buffer, bytes.byteOffset + offset, 4).getUint32(0);
    const type = decoder.decode(bytes.slice(offset + 4, offset + 8));
    const data = bytes.slice(offset + 8, offset + 8 + length);
    if (type === "iTXt") {
      const firstNull = data.indexOf(0);
      const keyword = decoder.decode(data.slice(0, firstNull));
      if (keyword === FORMAT) return JSON.parse(decoder.decode(data.slice(firstNull + 5)));
    }
    offset += length + 12;
  }
  throw new Error("This PNG is not an exported Pokee-Pal battle card.");
}

const loadImage = (src) => new Promise((resolve, reject) => {
  const image = new Image(); image.crossOrigin = "anonymous"; image.onload = () => resolve(image); image.onerror = () => reject(new Error("Could not load the pal image.")); image.src = src;
});
const canvasBlob = (canvas) => new Promise((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("Could not create the PNG.")), "image/png"));
const getImageSource = (pal) => pal.imageData || (pal.imageUrl?.startsWith("/") ? apiUrl(pal.imageUrl) : pal.imageUrl);

export async function exportBattleCard(input) {
  const pal = normalizePortablePal(input, { imported: input.imported });
  const canvas = document.createElement("canvas"); canvas.width = 900; canvas.height = 1320;
  const ctx = canvas.getContext("2d");
  const gradient = ctx.createLinearGradient(0, 0, 900, 1320); gradient.addColorStop(0, "#fffaf0"); gradient.addColorStop(1, "#e1eadb");
  const frameColors = { "starter-linen": "#68835b", "ready-to-evolve": "#d97706", "bronze-star": "#b45309", "silver-star": "#94a3b8", "aurora-star": "#8b5cf6", "celestial-star": "#2563eb", "legendary-max": "#f59e0b", "champion-crown": "#eab308", "windrunner-wisp": "#06b6d4", "tactician-quilt": "#db2777" };
  ctx.fillStyle = gradient; ctx.fillRect(0, 0, 900, 1320); ctx.strokeStyle = frameColors[pal.selectedFrame] || "#68835b"; ctx.lineWidth = pal.selectedFrame === "legendary-max" ? 30 : 18; ctx.strokeRect(24, 24, 852, 1272);
  ctx.fillStyle = "#3c352d"; ctx.font = "bold 54px Georgia"; ctx.fillText(pal.name, 70, 95);
  ctx.font = "bold 25px sans-serif"; ctx.fillStyle = "#68835b"; ctx.fillText(`${pal.type}  •  ${"★".repeat(pal.starLevel)}  •  Level ${pal.level}`, 72, 137);
  const source = getImageSource(pal);
  if (source) {
    const image = await loadImage(source); const scale = Math.min(700 / image.width, 590 / image.height);
    const width = image.width * scale; const height = image.height * scale;
    ctx.fillStyle = "#ffffffbb"; ctx.fillRect(70, 170, 760, 610); ctx.drawImage(image, 450 - width / 2, 475 - height / 2, width, height);
  }
  ctx.fillStyle = "#3c352d"; ctx.font = "22px sans-serif";
  const stats = Object.entries(pal.stats); stats.forEach(([key, value], index) => {
    const x = 75 + (index % 2) * 390, y = 830 + Math.floor(index / 2) * 62;
    ctx.fillText(`${key[0].toUpperCase() + key.slice(1)}: ${value}`, x, y); ctx.fillStyle = "#dfd2bc"; ctx.fillRect(x, y + 12, 300, 12); ctx.fillStyle = "#68835b"; ctx.fillRect(x, y + 12, 300 * value / 250, 12); ctx.fillStyle = "#3c352d";
  });
  ctx.font = "bold 25px Georgia"; ctx.fillText("Attacks", 75, 980); ctx.font = "20px sans-serif";
  pal.attacks.slice(0, 4).forEach((attack, index) => ctx.fillText(`${attack.name}  •  ${attack.kind === "attack" ? `Power ${attack.power}` : attack.kind}`, 75, 1015 + index * 34));
  const badges = Object.keys(pal.achievements || {}).filter((key) => pal.achievements[key]).slice(0, 3);
  ctx.font = "17px sans-serif"; ctx.fillStyle = "#7d7062"; ctx.fillText(`Record ${pal.battleRecord.wins || 0}W–${pal.battleRecord.losses || 0}L  •  XP ${pal.xp}/${pal.level * 100}`, 75, 1180);
  ctx.fillText(`Badges: ${badges.length ? badges.join(" · ") : "None yet"}`, 75, 1215);
  ctx.fillText(`Frame: ${pal.selectedFrame}  •  Pokee-Pal shared battle card`, 75, 1260);
  const basePng = new Uint8Array(await (await canvasBlob(canvas)).arrayBuffer());
  const payload = { ...pal, id: undefined, imported: undefined, imageData: pal.imageData || "", imageUrl: pal.imageUrl || "" };
  const blob = new Blob([insertMetadata(basePng, payload)], { type: "image/png" });
  const link = document.createElement("a"); link.href = URL.createObjectURL(blob); link.download = `pokee-pal-${pal.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-level-${pal.level}.png`; link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}

export async function importBattleCard(file) {
  if (!file || file.type !== "image/png") throw new Error("Choose a PNG battle card.");
  if (file.size > MAX_FILE_SIZE) throw new Error("Battle cards must be smaller than 10 MB.");
  const data = readMetadata(new Uint8Array(await file.arrayBuffer()));
  if (data.format !== FORMAT || ![1, VERSION].includes(Number(data.version))) throw new Error("Unsupported Pokee-Pal card version.");
  return normalizePortablePal({ ...data, id: undefined, imageData: URL.createObjectURL(file), imageUrl: "" }, { imported: true });
}
