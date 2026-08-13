import crypto from 'crypto';
import { buildPortablePal, evasionChance, typeEffectiveness } from './battle.js';

function randomFor(state) {
  state.randomState = (Math.imul(state.randomState >>> 0, 1664525) + 1013904223) >>> 0;
  return state.randomState / 4294967296;
}

export function availableMoves(state, fighterIndex) {
  // Availability is derived from persisted uses and cooldowns; the client only
  // receives legal choices and never decides whether a move can execute.
  const fighter = state.fighters[fighterIndex];
  return fighter.pal.attacks.map((move) => ({
    ...move,
    usesRemaining: Math.max(0, move.maxUses - (fighter.uses[move.name] || 0)),
    cooldownRemaining: Math.max(0, (fighter.cooldowns[move.name] || 0) - state.round),
  })).filter((move) => move.usesRemaining > 0 && move.cooldownRemaining === 0);
}

function chooseAiMove(state, index) {
  const fighter = state.fighters[index];
  const legal = availableMoves(state, index).filter((move) => !(move.kind === 'heal' && fighter.hp >= fighter.pal.stats.health));
  const heal = legal.find((move) => move.kind === 'heal');
  if (heal && fighter.hp / fighter.pal.stats.health <= 0.4) return heal;
  return legal[Math.floor(randomFor(state) * legal.length)] || { name: 'Last-Ditch Doodle', kind: 'attack', power: 32, accuracy: 100, recoilPercent: 0, drainPercent: 0, piercePercent: 0, executeBonus: 0, critBonus: 0, type: fighter.pal.type.split('/')[0], maxUses: 999, tier: 'fallback', cooldown: 0 };
}

function snapshot(state) {
  return Object.fromEntries(state.fighters.map((fighter) => [fighter.pal.cardId, fighter.hp]));
}

function perform(state, attackerIndex, defenderIndex, move) {
  // Mutate the round's server-owned state in a fixed order so damage, healing,
  // reflection, cooldowns, and the event log describe the same outcome.
  const attacker = state.fighters[attackerIndex];
  const defender = state.fighters[defenderIndex];
  if (attacker.hp <= 0) return;
  attacker.uses[move.name] = (attacker.uses[move.name] || 0) + 1;
  if (move.cooldown) attacker.cooldowns[move.name] = state.round + move.cooldown;
  const common = { round: state.round, turn: state.log.length + 1, attacker: attacker.pal.cardId, defender: defender.pal.cardId, move: move.name, moveType: move.type, moveTier: move.tier, usesRemaining: Math.max(0, move.maxUses - attacker.uses[move.name]) };
  if (move.kind === 'heal') {
    const amount = Math.min(attacker.pal.stats.health - attacker.hp, Math.round(attacker.pal.stats.health * (0.1 + move.power / 400)));
    attacker.hp += amount; state.log.push({ ...common, kind: 'heal', amount, health: snapshot(state) });
  } else if (move.kind === 'block') {
    attacker.shield = Math.round(attacker.pal.stats.defense * (0.25 + move.power / 200));
    state.log.push({ ...common, kind: 'block', amount: attacker.shield, health: snapshot(state) });
  } else if (move.kind === 'reflect') {
    attacker.reflect = Math.min(0.6, 0.2 + attacker.pal.stats.defense / 1000);
    state.log.push({ ...common, kind: 'reflect', amount: Math.round(attacker.reflect * 100), health: snapshot(state) });
  } else if (randomFor(state) * 100 >= move.accuracy) {
    state.log.push({ ...common, kind: 'attack', missed: true, accuracy: move.accuracy, damage: 0, blocked: 0, reflected: 0, health: snapshot(state) });
  } else if (randomFor(state) < evasionChance(attacker.pal.stats.speed, defender.pal.stats.speed)) {
    defender.shield = 0;
    state.log.push({ ...common, kind: 'attack', evaded: true, damage: 0, blocked: 0, reflected: 0, health: snapshot(state) });
  } else {
    const effectiveness = typeEffectiveness(move.type, defender.pal.type);
    const tierPower = move.tier === 'heavy' ? 68 : move.tier === 'medium' ? 59 : move.tier === 'fallback' ? 32 : 49;
    const critical = randomFor(state) < Math.min(0.65, Math.max(0.04, Math.min(0.15, 0.06 + (attacker.pal.stats.speed - defender.pal.stats.speed) / 1500)) + move.critBonus);
    const effectiveDefense = defender.pal.stats.defense * (1 - move.piercePercent / 100);
    const executeMultiplier = defender.hp / defender.pal.stats.health <= 0.35 ? 1 + move.executeBonus / 100 : 1;
    const raw = effectiveness === 0 ? 0 : Math.max(1, Math.round((tierPower * attacker.pal.stats.attack / Math.max(1, effectiveDefense) / 4 + 3) * effectiveness * executeMultiplier * (critical ? 1.35 : 1)));
    const blocked = Math.min(defender.shield, raw); defender.shield = 0;
    const damage = raw - blocked; defender.hp = Math.max(0, defender.hp - damage);
    const reflected = defender.reflect ? Math.min(attacker.hp, Math.round(damage * defender.reflect)) : 0;
    defender.reflect = 0; attacker.hp = Math.max(0, attacker.hp - reflected);
    const drained = Math.min(attacker.pal.stats.health - attacker.hp, Math.round(damage * move.drainPercent / 100)); attacker.hp += drained;
    const recoil = Math.min(attacker.hp, Math.round(damage * move.recoilPercent / 100)); attacker.hp = Math.max(0, attacker.hp - recoil);
    state.log.push({ ...common, kind: 'attack', evaded: false, missed: false, accuracy: move.accuracy, critical, effectiveness, damage, blocked, reflected, drained, recoil, pierced: move.piercePercent, executeBoosted: executeMultiplier > 1, health: snapshot(state) });
  }
  if (move.kind !== 'attack') defender.shield = 0;
}

export function createManualBattle(leftInput, rightInput, seed = crypto.randomInt(1, 2147483647)) {
  // Manual battles store normalized snapshots, preventing gallery edits from
  // changing combatants halfway through an active session.
  const pals = [buildPortablePal(leftInput, { imported: !leftInput.id }), buildPortablePal(rightInput, { imported: !rightInput.id })];
  return { mode: 'manual', seed, randomState: seed, round: 1, status: 'active', log: [], fighters: pals.map((pal) => ({ pal, hp: pal.stats.health, shield: 0, reflect: 0, uses: {}, cooldowns: {} })) };
}

export function resolveManualRound(state, moveName) {
  // Resolve the player's selected move and the AI response atomically; callers
  // persist the returned state before accepting the next action.
  if (state.status !== 'active') throw new Error('Battle is already complete');
  const playerMove = availableMoves(state, 0).find((move) => move.name === moveName);
  if (!playerMove) throw new Error('That move is unavailable, exhausted, or cooling down');
  const aiMove = chooseAiMove(state, 1);
  const selections = [playerMove, aiMove];
  const order = state.fighters[0].pal.stats.speed >= state.fighters[1].pal.stats.speed ? [0, 1] : [1, 0];
  for (const attacker of order) {
    const defender = attacker === 0 ? 1 : 0;
    perform(state, attacker, defender, selections[attacker]);
    if (state.fighters.some((fighter) => fighter.hp <= 0)) break;
  }
  if (state.fighters.some((fighter) => fighter.hp <= 0) || state.round >= 50) {
    state.status = 'complete';
    const winnerIndex = state.fighters[0].hp / state.fighters[0].pal.stats.health >= state.fighters[1].hp / state.fighters[1].pal.stats.health ? 0 : 1;
    state.winner = state.fighters[winnerIndex].pal; state.loser = state.fighters[1 - winnerIndex].pal;
    state.finalHealth = snapshot(state);
  } else state.round += 1;
  return state;
}
