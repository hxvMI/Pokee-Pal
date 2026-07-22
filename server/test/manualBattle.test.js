import test from 'node:test';
import assert from 'node:assert/strict';
import { applyXp, buildPortablePal, moveInventoryFor } from '../src/battle.js';
import { availableMoves, createManualBattle, resolveManualRound } from '../src/manualBattle.js';

const makePal = (cardId, speed) => buildPortablePal({ cardId, name: cardId, type: 'Fire', level: 1, starLevel: 1, stats: { attack: 80, defense: 75, health: 100, speed }, powers: [{ name: `${cardId} Spark`, power: 48 }] });

test('manual battles expose four equipped moves and resolve selected rounds', () => {
  const state = createManualBattle(makePal('left', 90), makePal('right', 70), 123);
  assert.equal(state.fighters[0].pal.attacks.length, 4);
  const move = availableMoves(state, 0)[0];
  resolveManualRound(state, move.name);
  assert.ok(state.log.length >= 1);
});

test('level five stops xp and has stronger unlocked moves', () => {
  const pal = makePal('maxed', 80);
  const progressed = { ...pal, level: 5, xp: 0 };
  const result = applyXp(progressed, 500);
  assert.equal(result.pal.level, 5);
  assert.equal(result.pal.xp, 0);
  assert.ok(moveInventoryFor(progressed).some((move) => move.unlockLevel === 5));
});
