import test from 'node:test';
import assert from 'node:assert/strict';
import { applyXp, buildPortablePal, evasionChance, normalizeAttacks, normalizeStats, simulateBattle, typeEffectiveness } from '../src/battle.js';

const pal = (cardId, overrides = {}) => buildPortablePal({
  cardId, name: cardId, type: 'Normal', stats: { attack: 80, defense: 75, health: 100, speed: 70 },
  powers: [{ name: 'Bonk', description: 'A friendly bonk.', power: 40, unlockLevel: 1 }], ...overrides,
});

test('normalizers clamp untrusted card values', () => {
  assert.deepEqual(normalizeStats({ attack: 999, defense: -2, health: 90, speed: '12' }), { attack: 250, defense: 1, health: 90, speed: 12 });
  assert.equal(normalizeAttacks([{ name: 'Huge', power: 900 }])[0].power, 150);
  assert.deepEqual(normalizeAttacks([{ name: 'Guard', kind: 'block', cooldown: 99 }])[0], {
    name: 'Guard', description: 'A spirited doodle-powered attack.', power: 35,
    unlockLevel: 1, unlockStar: 1, type: undefined, kind: 'block', cooldown: 20, maxUses: 2, tier: 'support',
    accuracy: 100, recoilPercent: 0, drainPercent: 0, piercePercent: 0, executeBonus: 0, critBonus: 0,
  });
});

test('move accuracy and modifiers are normalized safely', () => {
  const move = normalizeAttacks([{ name: 'Risky', power: 90, accuracy: 5, recoilPercent: 90, drainPercent: 20, piercePercent: 12, executeBonus: 30, critBonus: 4 }])[0];
  assert.equal(move.accuracy, 25);
  assert.equal(move.recoilPercent, 50);
  assert.equal(move.drainPercent, 20);
  assert.equal(move.piercePercent, 12);
  assert.equal(move.executeBonus, 30);
  assert.equal(move.critBonus, 0.5);
});

test('inaccurate moves can miss independently of evasion', () => {
  const risky = pal('risky', { equippedMoves: [
    { name: 'Wild Swing', power: 90, accuracy: 25, maxUses: 20 },
    { name: 'Cozy Guard', kind: 'block', power: 40, maxUses: 1 },
    { name: 'Backup One', power: 30, accuracy: 25, maxUses: 20 },
    { name: 'Backup Two', power: 30, accuracy: 25, maxUses: 20 },
  ] });
  const result = simulateBattle(risky, pal('target'), 42);
  assert.ok(result.log.some((entry) => entry.missed));
});

test('same seed produces the same battle log', () => {
  const first = simulateBattle(pal('one'), pal('two', { stats: { attack: 70, defense: 70, health: 90, speed: 90 } }), 12345);
  const second = simulateBattle(pal('one'), pal('two', { stats: { attack: 70, defense: 70, health: 90, speed: 90 } }), 12345);
  assert.deepEqual(first.log, second.log);
  assert.equal(first.winner.cardId, second.winner.cardId);
});

test('xp levels a pal and awards four points', () => {
  const result = applyXp({ ...pal('one'), xp: 75, level: 1, unspentStatPoints: 0 }, 50);
  assert.equal(result.pal.level, 2);
  assert.equal(result.pal.xp, 25);
  assert.equal(result.pal.unspentStatPoints, 4);
});

test('type advantages handle dual types and immunities', () => {
  assert.equal(typeEffectiveness('Fire', 'Grass'), 2);
  assert.equal(typeEffectiveness('Fire', 'Grass/Steel'), 4);
  assert.equal(typeEffectiveness('Electric', 'Water/Ground'), 0);
  assert.equal(typeEffectiveness('Water', 'Grass'), 0.5);
});

test('support abilities respect their five-turn cooldown', () => {
  const result = simulateBattle(
    pal('one', { stats: { attack: 20, defense: 180, health: 220, speed: 80 } }),
    pal('two', { stats: { attack: 20, defense: 180, health: 220, speed: 70 } }),
    24680,
  );
  const supportTurns = result.log.filter((entry) => entry.kind !== 'attack');
  assert.ok(supportTurns.length > 0);
  for (const fighterId of ['one', 'two']) {
    for (const move of ['Patch-Up Picnic', 'Cozy Guard', 'Mirror Doodle']) {
      const uses = supportTurns.filter((entry) => entry.attacker === fighterId && entry.move === move).map((entry) => entry.turn);
      for (let index = 1; index < uses.length; index += 1) assert.ok(uses[index] - uses[index - 1] >= 5);
    }
  }
});

test('every move respects its per-battle use limit', () => {
  const result = simulateBattle(
    pal('one', { stats: { attack: 10, defense: 230, health: 250, speed: 80 } }),
    pal('two', { stats: { attack: 10, defense: 230, health: 250, speed: 70 } }),
    13579,
  );
  for (const fighter of [result.winner, result.loser]) {
    for (const move of fighter.attacks) {
      const uses = result.log.filter((entry) => entry.attacker === fighter.cardId && entry.move === move.name).length;
      assert.ok(uses <= move.maxUses, `${move.name} exceeded ${move.maxUses} uses`);
    }
  }
});

test('higher-power attacks produce more base damage with the same seed and stats', () => {
  const [weak, strong] = normalizeAttacks([{ name: 'Tap', power: 40 }, { name: 'Crash', power: 100 }]);
  assert.ok(strong.power > weak.power);
});

test('speed evasion stays useful but bounded', () => {
  assert.equal(evasionChance(250, 1), 0.02);
  assert.equal(evasionChance(1, 250), 0.22);
  assert.ok(evasionChance(70, 100) > evasionChance(100, 70));
});

test('battle results include per-pal combat summaries', () => {
  const result = simulateBattle(pal('one'), pal('two'), 98765);
  assert.ok(result.summary.one);
  assert.ok(result.summary.two);
  assert.equal(typeof result.summary.one.damage, 'number');
  assert.equal(typeof result.summary.one.evasions, 'number');
});

test('each pal receives four stable moves and always has guard', () => {
  const first = pal('stable-card', { type: 'Fire' });
  const second = pal('stable-card', { type: 'Fire' });
  assert.equal(first.attacks.length, 4);
  assert.ok(first.attacks.some((move) => move.kind === 'block'));
  assert.deepEqual(first.attacks, second.attacks);
  assert.ok(first.attacks.filter((move) => move.kind === 'attack').every((move) => move.type === 'Fire'));
});

test('attack tiers receive expanded per-battle uses', () => {
  const moves = normalizeAttacks([
    { name: 'Light', power: 48 },
    { name: 'Medium', power: 70 },
    { name: 'Heavy', power: 90 },
  ]);
  assert.equal(moves[0].maxUses, 8);
  assert.equal(moves[1].maxUses, 6);
  assert.equal(moves[2].maxUses, 4);
});

test('a shield can only block the action immediately after it was raised', () => {
  const result = simulateBattle(
    pal('one', { stats: { attack: 15, defense: 220, health: 250, speed: 80 } }),
    pal('two', { stats: { attack: 15, defense: 220, health: 250, speed: 70 } }),
    54321,
  );
  result.log.forEach((entry, index) => {
    if (!entry.blocked) return;
    const previous = result.log[index - 1];
    assert.equal(previous?.kind, 'block');
    assert.equal(previous?.attacker, entry.defender);
  });
});
