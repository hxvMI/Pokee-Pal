import crypto from 'crypto';

export const STAT_KEYS = ['attack', 'defense', 'health', 'speed'];
export const DEFAULT_STATS = { attack: 75, defense: 75, health: 100, speed: 75 };
export const MAX_LEVEL = 5;
export const MAX_STARS = 5;
export const FRAME_DEFINITIONS = {
  'starter-linen': { name: 'Starter Linen', requirement: 'Every pal' },
  'ready-to-evolve': { name: 'Ready to Evolve', requirement: 'Reach level 5' },
  'bronze-star': { name: 'Bronze Star', requirement: 'Reach 2 stars' },
  'silver-star': { name: 'Silver Star', requirement: 'Reach 3 stars' },
  'aurora-star': { name: 'Aurora Star', requirement: 'Reach 4 stars' },
  'celestial-star': { name: 'Celestial Star', requirement: 'Reach 5 stars' },
  'legendary-max': { name: 'Legendary Max', requirement: 'Reach 5 stars, level 5' },
  'champion-crown': { name: 'Champion Crown', requirement: 'Win 10 battles' },
  'windrunner-wisp': { name: 'Windrunner Wisp', requirement: 'Evade 5 times in one battle' },
  'tactician-quilt': { name: 'Tactician Quilt', requirement: 'Use every move category in one battle' },
};
export const ACHIEVEMENT_DEFINITIONS = {
  'first-victory': { name: 'First Victory' }, veteran: { name: 'Veteran' }, champion: { name: 'Champion' },
  windrunner: { name: 'Windrunner' }, 'close-call': { name: 'Close Call' }, tactician: { name: 'Tactician' },
  'type-triumph': { name: 'Type Triumph' }, 'max-potential': { name: 'Max Potential' },
};

const ATTACK_POOL = {
  Fire: [{ name: 'Ember Waltz', description: 'A precise ember dance with a better critical-hit chance.', power: 48, accuracy: 100, critBonus: 0.08, unlockLevel: 3 }, { name: 'Hearthflare', description: 'A fierce flame that restores some damage as health.', power: 68, accuracy: 90, drainPercent: 20, unlockLevel: 5 }, { name: 'Comet Cinder', description: 'A devastating falling spark that causes recoil.', power: 88, accuracy: 75, recoilPercent: 20, unlockLevel: 8 }],
  Water: [{ name: 'Ripple Rush', description: 'A precise wave that partially ignores defense.', power: 48, accuracy: 100, piercePercent: 15, unlockLevel: 3 }, { name: 'Moonlit Tide', description: 'A tide that hits weakened rivals harder.', power: 68, accuracy: 90, executeBonus: 25, unlockLevel: 5 }, { name: 'Deepsea Roar', description: 'A crushing surge with huge power but uncertain accuracy.', power: 88, accuracy: 75, unlockLevel: 8 }],
  Grass: [{ name: 'Mossy Tumble', description: 'A steady roll that absorbs a little damage as health.', power: 48, accuracy: 100, drainPercent: 10, unlockLevel: 3 }, { name: 'Bramble Hug', description: 'Determined vines that pierce defensive strength.', power: 68, accuracy: 90, piercePercent: 20, unlockLevel: 5 }, { name: 'Ancient Bloom', description: 'A risky enchanted bloom that drains health.', power: 88, accuracy: 75, drainPercent: 25, unlockLevel: 8 }],
  Electric: [{ name: 'Static Skip', description: 'A quick spark with a better critical-hit chance.', power: 48, accuracy: 100, critBonus: 0.1, unlockLevel: 3 }, { name: 'Lantern Bolt', description: 'A bright bolt that punishes weakened rivals.', power: 68, accuracy: 90, executeBonus: 20, unlockLevel: 5 }, { name: 'Storm Stitch', description: 'Wild lightning with huge power and recoil.', power: 88, accuracy: 75, recoilPercent: 15, unlockLevel: 8 }],
  Normal: [{ name: 'Cozy Charge', description: 'A dependable charge that rarely misses.', power: 48, accuracy: 100, unlockLevel: 3 }, { name: 'Pillow Pummel', description: 'A soft strike with a better critical-hit chance.', power: 68, accuracy: 90, critBonus: 0.1, unlockLevel: 5 }, { name: 'Storybook Finale', description: 'A dramatic finisher that punishes weakened rivals.', power: 88, accuracy: 75, executeBonus: 30, unlockLevel: 8 }],
};

const SUPPORT_ABILITIES = [
  { name: 'Patch-Up Picnic', description: 'Takes a quick restorative snack break.', power: 36, unlockLevel: 1, kind: 'heal', cooldown: 5, maxUses: 2, type: 'Normal' },
  { name: 'Cozy Guard', description: 'Builds a cushiony shield against the next hit.', power: 40, unlockLevel: 1, kind: 'block', cooldown: 5, maxUses: 2, type: 'Normal' },
  { name: 'Mirror Doodle', description: 'Reflects part of the next hit back at its source.', power: 30, unlockLevel: 1, kind: 'reflect', cooldown: 5, maxUses: 1, type: 'Psychic' },
];

const TYPE_MOVE_WORDS = {
  Ice: ['Frost Flick', 'Glacier Gleam', 'Snowdrift Spin'], Ground: ['Pebble Quake', 'Burrow Burst', 'Canyon Clap'],
  Flying: ['Breeze Bounce', 'Cloud Corkscrew', 'Gale Glide'], Psychic: ['Mind Ripple', 'Dream Orbit', 'Thought Spark'],
  Rock: ['Stone Skip', 'Crag Crash', 'Gem Rumble'], Ghost: ['Phantom Wink', 'Haunt Hop', 'Spectral Sweep'],
  Dragon: ['Scale Spark', 'Wyrm Whirl', 'Comet Roar'], Dark: ['Moon Sneak', 'Gloom Pounce', 'Midnight Feint'],
  Steel: ['Tin Tumble', 'Gear Grind', 'Silver Slam'], Fairy: ['Pixie Twirl', 'Starlight Sprinkle', 'Wishful Whack'],
  Fighting: ['Bouncy Jab', 'Brave Uppercut', 'Champion Stomp'], Poison: ['Toxic Tickle', 'Misty Venom', 'Sludge Spiral'],
  Bug: ['Antenna Zap', 'Cocoon Roll', 'Swarm Shuffle'],
};

const TYPE_CHART = {
  Normal: { Rock: 0.5, Ghost: 0, Steel: 0.5 },
  Fire: { Fire: 0.5, Water: 0.5, Grass: 2, Ice: 2, Rock: 0.5, Dragon: 0.5, Steel: 2 },
  Water: { Fire: 2, Water: 0.5, Grass: 0.5, Ground: 2, Rock: 2, Dragon: 0.5 },
  Electric: { Water: 2, Electric: 0.5, Grass: 0.5, Ground: 0, Flying: 2, Dragon: 0.5 },
  Grass: { Fire: 0.5, Water: 2, Grass: 0.5, Ground: 2, Flying: 0.5, Rock: 2, Dragon: 0.5, Steel: 0.5 },
  Ice: { Fire: 0.5, Water: 0.5, Grass: 2, Ice: 0.5, Ground: 2, Flying: 2, Dragon: 2, Steel: 0.5 },
  Ground: { Fire: 2, Electric: 2, Grass: 0.5, Flying: 0, Rock: 2, Steel: 2 },
  Flying: { Electric: 0.5, Grass: 2, Rock: 0.5, Steel: 0.5 },
  Psychic: { Psychic: 0.5, Dark: 0, Steel: 0.5 },
  Rock: { Fire: 2, Ice: 2, Flying: 2, Ground: 0.5, Steel: 0.5 },
  Ghost: { Normal: 0, Psychic: 2, Ghost: 2, Dark: 0.5 },
  Dragon: { Dragon: 2, Steel: 0.5, Fairy: 0 },
  Dark: { Psychic: 2, Ghost: 2, Dark: 0.5, Fairy: 0.5 },
  Steel: { Fire: 0.5, Water: 0.5, Electric: 0.5, Ice: 2, Rock: 2, Steel: 0.5, Fairy: 2 },
  Fairy: { Fire: 0.5, Dragon: 2, Dark: 2, Steel: 0.5 },
};

const canonicalType = (value) => {
  const text = String(value || 'Normal').trim().toLowerCase();
  return Object.keys(TYPE_CHART).find((type) => type.toLowerCase() === text) || 'Normal';
};

export function typeEffectiveness(attackType, defenderType) {
  const attacking = canonicalType(attackType);
  return String(defenderType || 'Normal').split('/').map(canonicalType)
    .reduce((multiplier, type) => multiplier * (TYPE_CHART[attacking]?.[type] ?? 1), 1);
}

export function evasionChance(attackerSpeed, defenderSpeed) {
  const difference = Number(defenderSpeed) - Number(attackerSpeed);
  return Math.max(0.02, Math.min(0.22, 0.04 + difference / 800));
}

function criticalChance(attackerSpeed, defenderSpeed) {
  return Math.max(0.04, Math.min(0.15, 0.06 + (Number(attackerSpeed) - Number(defenderSpeed)) / 1500));
}

function moveTier(power, maxUses) {
  if (maxUses <= 2 || power >= 85) return 'heavy';
  if (maxUses <= 3 || power >= 65) return 'medium';
  return 'light';
}

function balancedAttackPower(move) {
  if (move.name === 'Last-Ditch Doodle') return 32;
  const tier = move.tier || moveTier(move.power, move.maxUses);
  if (tier === 'heavy') return Math.min(72, 66 + Math.max(0, move.power - 85) * 0.05);
  if (tier === 'medium') return Math.min(63, 57 + Math.max(0, move.power - 65) * 0.08);
  return Math.min(54, 46 + Math.max(0, move.power - 40) * 0.12);
}

function randomFromCardId(cardId) {
  let state = 2166136261;
  for (const character of String(cardId)) state = Math.imul(state ^ character.charCodeAt(0), 16777619);
  return () => ((state = Math.imul(1664525, state) + 1013904223 >>> 0) / 4294967296);
}

function fallbackTypeMoves(type) {
  const names = TYPE_MOVE_WORDS[type] || [`${type} Tumble`, `${type} Spark`, `${type} Finale`];
  const styles = [
    { accuracy: 100, critBonus: 0.06, description: 'a precise technique with a better critical-hit chance' },
    { accuracy: 90, piercePercent: 15, description: 'a forceful technique that pierces some defense' },
    { accuracy: 75, recoilPercent: 15, description: 'a risky high-power technique that causes recoil' },
  ];
  return names.map((name, index) => ({ name, description: `Channels ${type.toLowerCase()} energy in ${styles[index].description}.`, power: 48 + index * 20, unlockLevel: 1, type, kind: 'attack', ...styles[index] }));
}

const clampInt = (value, min, max, fallback) => {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(min, Math.min(max, Math.round(number))) : fallback;
};

export function parseLegacyCharacteristics(value) {
  if (!value) return { description: '', stats: null };
  if (typeof value === 'object') return { description: value.description || '', stats: value.stats || value };
  try {
    const parsed = JSON.parse(value);
    return { description: parsed.description || '', stats: parsed.stats || parsed };
  } catch {
    return { description: String(value), stats: null };
  }
}

export function normalizeStats(value, fallback = DEFAULT_STATS) {
  return Object.fromEntries(STAT_KEYS.map((key) => [key, clampInt(value?.[key], 1, 250, fallback[key])]));
}

export function normalizeAttacks(value) {
  const attacks = Array.isArray(value) ? value : [];
  const normalized = attacks.slice(0, 40).map((attack, index) => {
    const kind = ['attack', 'heal', 'block', 'reflect'].includes(attack?.kind) ? attack.kind : 'attack';
    const fallbackPower = kind === 'attack' ? Math.min(95, 48 + index * 18) : 35;
    const power = Number(attack?.power) === 35 && attacks.length > 1 && kind === 'attack'
      ? fallbackPower
      : clampInt(attack?.power, 1, 150, fallbackPower);
    const defaultUses = kind === 'heal' || kind === 'block' ? 2 : kind === 'reflect' ? 1 : power >= 85 ? 4 : power >= 65 ? 6 : 8;
    return ({
    name: String(attack?.name || `Doodle Move ${index + 1}`).slice(0, 60),
    description: String(attack?.description || 'A spirited doodle-powered attack.').slice(0, 240),
    power,
    unlockLevel: clampInt(attack?.unlockLevel, 1, 99, 1),
    unlockStar: clampInt(attack?.unlockStar, 1, 5, 1),
    type: attack?.type ? canonicalType(attack.type) : undefined,
    kind,
    cooldown: clampInt(attack?.cooldown, 0, 20, attack?.kind && attack.kind !== 'attack' ? 5 : 0),
    maxUses: kind === 'attack' ? defaultUses : clampInt(attack?.maxUses, 1, 20, defaultUses),
    tier: kind === 'attack' ? (attack?.tier || moveTier(power, defaultUses)) : 'support',
    accuracy: clampInt(attack?.accuracy, 25, 100, 100),
    recoilPercent: clampInt(attack?.recoilPercent, 0, 50, 0),
    drainPercent: clampInt(attack?.drainPercent, 0, 50, 0),
    piercePercent: clampInt(attack?.piercePercent, 0, 50, 0),
    executeBonus: clampInt(attack?.executeBonus, 0, 100, 0),
    critBonus: Math.max(0, Math.min(0.5, Number(attack?.critBonus) || 0)),
  });
  });
  return normalized.length ? normalized : normalizeAttacks([{ name: 'Doodle Dash', description: 'Rushes ahead in a precise trail of ink.', power: 48, accuracy: 100, unlockLevel: 1 }]);
}

export function unlockedAttacksFor(pal) {
  const primaryType = canonicalType(String(pal.type || 'Normal').split('/')[0]);
  const stored = pal.attacks || pal.unlocked_attacks;
  if (Array.isArray(stored) && stored.length === 4 && stored.some((move) => move.name === 'Cozy Guard')) {
    return normalizeAttacks(stored).map((move) => ({ ...move, type: move.type || primaryType }));
  }
  const existing = normalizeAttacks(pal.powers || []).filter((move) => move.kind === 'attack');
  const pool = ATTACK_POOL[primaryType] || fallbackTypeMoves(primaryType);
  const combined = [...existing, ...pool, ...fallbackTypeMoves(primaryType)];
  const attacks = [...new Map(combined.map((attack) => {
    const kind = attack.kind || 'attack';
    const maxUses = kind === 'heal' || kind === 'block' ? 2 : kind === 'reflect' ? 1 : attack.power >= 85 ? 4 : attack.power >= 65 ? 6 : 8;
    return [attack.name.toLowerCase(), { ...attack, type: attack.type || canonicalType(primaryType), kind, cooldown: attack.cooldown || 0, maxUses, tier: kind === 'attack' ? (attack.tier || moveTier(attack.power, maxUses)) : 'support' }];
  })).values()];
  const random = randomFromCardId(pal.card_id || pal.cardId || pal.name);
  const shuffled = [...attacks].sort(() => random() - 0.5);
  const guard = { ...SUPPORT_ABILITIES.find((move) => move.kind === 'block') };
  const roll = random();
  const fourth = roll < 0.4
    ? { ...SUPPORT_ABILITIES.find((move) => move.kind === 'heal') }
    : roll < 0.7
      ? { ...SUPPORT_ABILITIES.find((move) => move.kind === 'reflect') }
      : shuffled[2];
  return normalizeAttacks([shuffled[0], shuffled[1], guard, fourth]).map((move) => ({ ...move, unlockLevel: 1, type: move.type || primaryType }));
}

function progressionMove(type, star, level) {
  const suffix = star > 1 ? ` ${['I', 'II', 'III', 'IV', 'V'][star - 1]}` : '';
  const configs = {
    2: { name: `${type} Crescendo${suffix}`, power: 58 + star, accuracy: 95, critBonus: 0.05, tier: 'medium', maxUses: 6, kind: 'attack' },
    3: star % 2 ? { ...SUPPORT_ABILITIES[0], name: `Restorative ${type} Glow${suffix}` } : { ...SUPPORT_ABILITIES[2], name: `${type} Looking Glass${suffix}` },
    4: { name: `${type} Grand Crash${suffix}`, power: 66 + star, accuracy: 85, piercePercent: 10 + star * 2, tier: 'heavy', maxUses: 4, kind: 'attack' },
    5: { name: `${type} Star Finale${suffix}`, power: 72 + star * 2, accuracy: 75, executeBonus: 15 + star * 3, recoilPercent: 10, tier: 'heavy', maxUses: 2, kind: 'attack' },
  };
  const move = configs[level];
  return { ...move, description: `${move.name} is a stronger ${type.toLowerCase()} technique earned at star ${star}, level ${level}.`, type, unlockLevel: level, unlockStar: star, cooldown: move.cooldown || 0 };
}

export function moveInventoryFor(pal) {
  const type = canonicalType(String(pal.type || 'Normal').split('/')[0]);
  const starLevel = clampInt(pal.star_level ?? pal.starLevel, 1, MAX_STARS, 1);
  const level = clampInt(pal.level, 1, MAX_LEVEL, 1);
  const storedSource = pal.unlocked_moves || pal.unlockedMoves;
  const stored = Array.isArray(storedSource) ? normalizeAttacks(storedSource) : [];
  const initial = unlockedAttacksFor({ ...pal, attacks: undefined, unlocked_attacks: undefined });
  const earned = [];
  for (let star = 1; star <= starLevel; star += 1) {
    const reachedLevel = star < starLevel ? MAX_LEVEL : level;
    for (let moveLevel = 2; moveLevel <= reachedLevel; moveLevel += 1) earned.push(progressionMove(type, star, moveLevel));
  }
  return [...new Map([...stored, ...initial, ...normalizeAttacks(earned)].map((move) => [move.name.toLowerCase(), move])).values()];
}

export function equippedMovesFor(pal, inventory = moveInventoryFor(pal)) {
  const equippedSource = pal.equipped_moves || pal.equippedMoves;
  const requested = Array.isArray(equippedSource) ? equippedSource : Array.isArray(pal.attacks) && pal.attacks.length === 4 ? pal.attacks : [];
  const byName = new Map(inventory.map((move) => [move.name.toLowerCase(), move]));
  let equipped = requested.map((move) => byName.get(String(move.name || move).toLowerCase())).filter(Boolean);
  const guard = inventory.find((move) => move.name === 'Cozy Guard');
  if (!equipped.some((move) => move.name === 'Cozy Guard')) equipped = [guard, ...equipped].filter(Boolean);
  for (const move of inventory) if (equipped.length < 4 && !equipped.some((item) => item.name === move.name)) equipped.push(move);
  return equipped.slice(0, 4);
}

export function framesFor(pal) {
  const stars = clampInt(pal.star_level ?? pal.starLevel, 1, 5, 1);
  const level = clampInt(pal.level, 1, 5, 1);
  const achievements = pal.achievements || {};
  const frameSource = pal.unlocked_frames || pal.unlockedFrames;
  const frames = new Set(Array.isArray(frameSource) ? frameSource : ['starter-linen']);
  if (level >= 5) frames.add('ready-to-evolve');
  if (stars >= 2) frames.add('bronze-star'); if (stars >= 3) frames.add('silver-star');
  if (stars >= 4) frames.add('aurora-star'); if (stars >= 5) frames.add('celestial-star');
  if (stars === 5 && level === 5) frames.add('legendary-max');
  if (achievements.champion) frames.add('champion-crown'); if (achievements.windrunner) frames.add('windrunner-wisp');
  if (achievements.tactician) frames.add('tactician-quilt');
  return [...frames];
}

export const xpForNextLevel = (level) => 100 * clampInt(level, 1, 100, 1);

export function buildPortablePal(pal, { imported = false } = {}) {
  // Collapse database rows, generated objects, and uploaded cards into the same
  // versioned representation consumed by both battle modes and card exports.
  const legacy = parseLegacyCharacteristics(pal.characteristics);
  const stats = normalizeStats(pal.stats || legacy.stats);
  const cardId = String(pal.card_id || pal.cardId || crypto.randomUUID());
  const unlockedMoves = moveInventoryFor(pal);
  const equippedMoves = equippedMovesFor(pal, unlockedMoves);
  const starLevel = clampInt(pal.star_level ?? pal.starLevel, 1, MAX_STARS, 1);
  const achievements = pal.achievements && typeof pal.achievements === 'object' ? pal.achievements : {};
  const unlockedFrames = framesFor({ ...pal, achievements });
  const selectedFrame = unlockedFrames.includes(pal.selected_frame || pal.selectedFrame) ? (pal.selected_frame || pal.selectedFrame) : 'starter-linen';
  return {
    format: 'pokee-pal-card', version: 2, cardId,
    id: pal.id ? Number(pal.id) : undefined,
    name: String(pal.name || 'Mystery Pal').slice(0, 100),
    type: String(pal.type || 'Normal').slice(0, 100),
    description: String(pal.description || legacy.description || 'A spirited arena companion.').slice(0, 300),
    sourceType: pal.source_type || pal.sourceType || (imported ? 'shared' : 'generated'),
    starLevel, level: clampInt(pal.level, 1, MAX_LEVEL, 1), xp: clampInt(pal.xp, 0, 1000000, 0),
    unspentStatPoints: clampInt(pal.unspent_stat_points ?? pal.unspentStatPoints, 0, 10000, 0),
    stats, attacks: equippedMoves, equippedMoves, unlockedMoves, selectedFrame, unlockedFrames, achievements,
    battleRecord: pal.battle_record || pal.battleRecord || { wins: 0, losses: 0, damage: 0, healing: 0, blocked: 0, reflected: 0, evasions: 0, criticals: 0 },
    imageUrl: pal.image_url || pal.imageUrl || '', imageData: pal.imageData || '', imported,
  };
}

function seededRandom(seed) {
  let state = seed >>> 0;
  return () => ((state = Math.imul(1664525, state) + 1013904223 >>> 0) / 4294967296);
}

export function simulateBattle(leftInput, rightInput, seed = crypto.randomInt(1, 2147483647)) {
  // Seeded randomness makes a completed match reproducible for tests and battle
  // records while still producing varied encounters for normal requests.
  const left = buildPortablePal(leftInput, { imported: !leftInput.id });
  const right = buildPortablePal(rightInput, { imported: !rightInput.id });
  const random = seededRandom(seed);
  const fighters = [left, right].map((pal, slot) => ({ pal, slot, hp: pal.stats.health, shield: 0, shieldExpiresAfter: 0, reflect: 0, cooldowns: {}, uses: {} }));
  let order = fighters[0].pal.stats.speed === fighters[1].pal.stats.speed
    ? (random() < 0.5 ? fighters : [...fighters].reverse())
    : [...fighters].sort((a, b) => b.pal.stats.speed - a.pal.stats.speed);
  const log = [];
  let turn = 0;
  for (; turn < 100 && fighters.every((fighter) => fighter.hp > 0); turn += 1) {
    const currentTurn = turn + 1;
    for (const fighter of fighters) {
      if (fighter.shield > 0 && currentTurn > fighter.shieldExpiresAfter) fighter.shield = 0;
    }
    const attacker = order[turn % 2];
    const defender = fighters.find((fighter) => fighter !== attacker);
    if (attacker.hp <= 0) break;
    const moves = attacker.pal.attacks.filter((move) => move.unlockLevel <= attacker.pal.level && turn + 1 >= (attacker.cooldowns[move.name] || 0) && (attacker.uses[move.name] || 0) < move.maxUses);
    const useful = moves.filter((move) => !(move.kind === 'heal' && attacker.hp >= attacker.pal.stats.health) && !(move.kind === 'block' && attacker.shield > 0) && !(move.kind === 'reflect' && attacker.reflect > 0));
    const healingMove = useful.find((move) => move.kind === 'heal');
    const move = attacker.hp / attacker.pal.stats.health <= 0.45 && healingMove
      ? healingMove
      : (useful[Math.floor(random() * useful.length)] || moves[0] || { name: 'Last-Ditch Doodle', description: 'A weak move that never runs out.', power: 32, accuracy: 100, recoilPercent: 0, drainPercent: 0, piercePercent: 0, executeBonus: 0, critBonus: 0, kind: 'attack', type: canonicalType(attacker.pal.type), cooldown: 0, maxUses: 999, tier: 'fallback' });
    attacker.uses[move.name] = (attacker.uses[move.name] || 0) + 1;
    const usesRemaining = Math.max(0, move.maxUses - attacker.uses[move.name]);
    if (move.cooldown) attacker.cooldowns[move.name] = turn + 1 + move.cooldown;

    if (move.kind === 'heal') {
      const amount = Math.max(1, Math.round(attacker.pal.stats.health * (0.1 + move.power / 400)));
      const healed = Math.min(amount, attacker.pal.stats.health - attacker.hp);
      attacker.hp += healed;
      log.push({ turn: turn + 1, kind: 'heal', attacker: attacker.pal.cardId, move: move.name, moveType: move.type, amount: healed, usesRemaining, health: Object.fromEntries(fighters.map((fighter) => [fighter.pal.cardId, fighter.hp])) });
      continue;
    }
    if (move.kind === 'block') {
      attacker.shield = Math.max(1, Math.round(attacker.pal.stats.defense * (0.25 + move.power / 200)));
      attacker.shieldExpiresAfter = currentTurn + 1;
      log.push({ turn: turn + 1, kind: 'block', attacker: attacker.pal.cardId, move: move.name, moveType: move.type, amount: attacker.shield, usesRemaining, health: Object.fromEntries(fighters.map((fighter) => [fighter.pal.cardId, fighter.hp])) });
      continue;
    }
    if (move.kind === 'reflect') {
      attacker.reflect = Math.min(0.6, 0.2 + attacker.pal.stats.defense / 1000);
      log.push({ turn: turn + 1, kind: 'reflect', attacker: attacker.pal.cardId, move: move.name, moveType: move.type, amount: Math.round(attacker.reflect * 100), usesRemaining, health: Object.fromEntries(fighters.map((fighter) => [fighter.pal.cardId, fighter.hp])) });
      continue;
    }

    if (random() * 100 >= move.accuracy) {
      log.push({ turn: turn + 1, kind: 'attack', attacker: attacker.pal.cardId, defender: defender.pal.cardId, move: move.name, moveType: move.type, moveTier: move.tier, missed: true, accuracy: move.accuracy, damage: 0, blocked: 0, reflected: 0, usesRemaining, health: Object.fromEntries(fighters.map((fighter) => [fighter.pal.cardId, fighter.hp])) });
      continue;
    }
    const evadeChance = evasionChance(attacker.pal.stats.speed, defender.pal.stats.speed);
    if (random() < evadeChance) {
      log.push({ turn: turn + 1, kind: 'attack', attacker: attacker.pal.cardId, defender: defender.pal.cardId, move: move.name, moveType: move.type, moveTier: move.tier, evaded: true, evadeChance, damage: 0, blocked: 0, reflected: 0, usesRemaining, health: Object.fromEntries(fighters.map((fighter) => [fighter.pal.cardId, fighter.hp])) });
      continue;
    }
    const effectiveDefense = defender.pal.stats.defense * (1 - move.piercePercent / 100);
    const ratio = attacker.pal.stats.attack / Math.max(1, effectiveDefense);
    const effectiveness = typeEffectiveness(move.type || attacker.pal.type, defender.pal.type);
    const combatPower = balancedAttackPower(move);
    const critical = random() < Math.min(0.65, criticalChance(attacker.pal.stats.speed, defender.pal.stats.speed) + move.critBonus);
    const base = (((2 * attacker.pal.level / 5) + 2) * combatPower * ratio) / 11 + 3;
    const executeMultiplier = defender.hp / defender.pal.stats.health <= 0.35 ? 1 + move.executeBonus / 100 : 1;
    const incomingDamage = effectiveness === 0 ? 0 : Math.max(1, Math.round(base * effectiveness * executeMultiplier * (0.94 + random() * 0.06) * (critical ? 1.35 : 1)));
    const blocked = Math.min(defender.shield, incomingDamage);
    defender.shield = Math.max(0, defender.shield - incomingDamage);
    const damage = incomingDamage - blocked;
    defender.hp = Math.max(0, defender.hp - damage);
    const reflected = defender.reflect > 0 ? Math.min(attacker.hp, Math.round(damage * defender.reflect)) : 0;
    if (defender.reflect > 0) defender.reflect = 0;
    attacker.hp = Math.max(0, attacker.hp - reflected);
    const drained = Math.min(attacker.pal.stats.health - attacker.hp, Math.round(damage * move.drainPercent / 100));
    attacker.hp += drained;
    const recoil = Math.min(attacker.hp, Math.round(damage * move.recoilPercent / 100));
    attacker.hp = Math.max(0, attacker.hp - recoil);
    log.push({ turn: turn + 1, kind: 'attack', attacker: attacker.pal.cardId, defender: defender.pal.cardId, move: move.name, moveType: move.type, moveTier: move.tier, accuracy: move.accuracy, effectiveness, critical, evaded: false, missed: false, damage, blocked, reflected, drained, recoil, pierced: move.piercePercent, executeBoosted: executeMultiplier > 1, usesRemaining, remainingHealth: defender.hp, defenderMaxHealth: defender.pal.stats.health, health: Object.fromEntries(fighters.map((fighter) => [fighter.pal.cardId, fighter.hp])) });
  }
  const healthRatio = (fighter) => fighter.hp / fighter.pal.stats.health;
  let winner = fighters.find((fighter) => fighter.hp > 0 && fighters.some((other) => other.hp === 0));
  if (!winner) winner = healthRatio(fighters[0]) >= healthRatio(fighters[1]) ? fighters[0] : fighters[1];
  const loser = fighters.find((fighter) => fighter !== winner);
  const summary = Object.fromEntries(fighters.map(({ pal }) => {
    const actions = log.filter((entry) => entry.attacker === pal.cardId);
    return [pal.cardId, {
      damage: actions.reduce((sum, entry) => sum + (entry.damage || 0), 0),
      healing: actions.reduce((sum, entry) => sum + (entry.kind === 'heal' ? entry.amount : 0), 0),
      blocked: log.filter((entry) => entry.defender === pal.cardId).reduce((sum, entry) => sum + (entry.blocked || 0), 0),
      reflected: log.filter((entry) => entry.defender === pal.cardId).reduce((sum, entry) => sum + (entry.reflected || 0), 0),
      evasions: log.filter((entry) => entry.defender === pal.cardId && entry.evaded).length,
      criticals: actions.filter((entry) => entry.critical).length,
    }];
  }));
  return { seed, turns: log.length, timedOut: log.length >= 100, log, summary, winner: winner.pal, loser: loser.pal, finalHealth: Object.fromEntries(fighters.map((fighter) => [fighter.pal.cardId, fighter.hp])) };
}

export function applyXp(pal, amount = 50) {
  // Progress one level at a time so unlocks and unspent stat awards remain
  // correct when a future reward crosses multiple thresholds.
  const updated = { ...pal };
  if (updated.level >= MAX_LEVEL) return { pal: { ...updated, xp: 0, unlockedMoves: moveInventoryFor(updated), unlockedFrames: framesFor(updated) }, levelsGained: 0 };
  updated.xp = pal.xp + amount;
  let levelsGained = 0;
  while (updated.level < MAX_LEVEL && updated.xp >= xpForNextLevel(updated.level)) {
    updated.xp -= xpForNextLevel(updated.level);
    updated.level += 1;
    levelsGained += 1;
  }
  updated.unspentStatPoints = (updated.unspentStatPoints || 0) + levelsGained * 4;
  if (updated.level >= MAX_LEVEL) updated.xp = 0;
  updated.unlockedMoves = moveInventoryFor(updated);
  updated.attacks = equippedMovesFor(updated, updated.unlockedMoves);
  updated.unlockedFrames = framesFor(updated);
  return { pal: updated, levelsGained };
}
