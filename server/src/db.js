// PostgreSQL persistence for creatures, progression, battle records, and sessions.
// Parameterized query values keep user data separate from SQL; JSONB holds structured fields.

import { URL } from 'url';
import pkg from 'pg';
import crypto from 'crypto';
import { normalizeAttacks, normalizeStats, parseLegacyCharacteristics } from './battle.js';
const { Pool } = pkg;

export class Database {
  constructor({ url }) {
    if (!url) {
      throw new Error('DATABASE_URL is required');
    }
    this.url = url;
    // Reuse database connections instead of creating a new connection for every request.
    this.pool = new Pool({
      connectionString: this.url,
    });
  }

  async connect() {
    // quick test query
    await this.pool.query('SELECT 1');
    console.log('[DB] Connected to Postgres.');
  }

  async initialize() {
    // Auto-create table if it doesn't exist
    // Note: image_url stores file paths like "/images/pokemon-123.png" (not data URLs)
    // Note: action_images stores {powerName: "/images/action-123.png"} mapping
    const schema = `
      CREATE TABLE IF NOT EXISTS generated_pokaimon (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        type VARCHAR(100),
        powers JSONB,
        characteristics TEXT,
        image_url TEXT,
        doodle_source TEXT,
        like_count INTEGER NOT NULL DEFAULT 0,
        action_images JSONB DEFAULT '{}'::jsonb
      );
      ALTER TABLE generated_pokaimon ADD COLUMN IF NOT EXISTS card_id UUID;
      ALTER TABLE generated_pokaimon ADD COLUMN IF NOT EXISTS level INTEGER NOT NULL DEFAULT 1;
      ALTER TABLE generated_pokaimon ADD COLUMN IF NOT EXISTS xp INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE generated_pokaimon ADD COLUMN IF NOT EXISTS unspent_stat_points INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE generated_pokaimon ADD COLUMN IF NOT EXISTS battle_wins INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE generated_pokaimon ADD COLUMN IF NOT EXISTS stats JSONB;
      ALTER TABLE generated_pokaimon ADD COLUMN IF NOT EXISTS unlocked_attacks JSONB DEFAULT '[]'::jsonb;
      ALTER TABLE generated_pokaimon ADD COLUMN IF NOT EXISTS star_level INTEGER NOT NULL DEFAULT 1;
      ALTER TABLE generated_pokaimon ADD COLUMN IF NOT EXISTS source_type TEXT NOT NULL DEFAULT 'generated';
      ALTER TABLE generated_pokaimon ADD COLUMN IF NOT EXISTS equipped_moves JSONB DEFAULT '[]'::jsonb;
      ALTER TABLE generated_pokaimon ADD COLUMN IF NOT EXISTS unlocked_moves JSONB DEFAULT '[]'::jsonb;
      ALTER TABLE generated_pokaimon ADD COLUMN IF NOT EXISTS selected_frame TEXT NOT NULL DEFAULT 'starter-linen';
      ALTER TABLE generated_pokaimon ADD COLUMN IF NOT EXISTS unlocked_frames JSONB DEFAULT '["starter-linen"]'::jsonb;
      ALTER TABLE generated_pokaimon ADD COLUMN IF NOT EXISTS achievements JSONB DEFAULT '{}'::jsonb;
      ALTER TABLE generated_pokaimon ADD COLUMN IF NOT EXISTS battle_record JSONB DEFAULT '{"wins":0,"losses":0,"damage":0,"healing":0,"blocked":0,"reflected":0,"evasions":0,"criticals":0}'::jsonb;
      CREATE UNIQUE INDEX IF NOT EXISTS generated_pokaimon_card_id_idx ON generated_pokaimon(card_id);
      CREATE TABLE IF NOT EXISTS battle_results (
        id BIGSERIAL PRIMARY KEY,
        winner_fingerprint TEXT NOT NULL,
        loser_fingerprint TEXT NOT NULL,
        winner_snapshot JSONB NOT NULL,
        loser_snapshot JSONB NOT NULL,
        seed INTEGER NOT NULL,
        battle_log JSONB NOT NULL,
        xp_awarded INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS battle_matchup_idx ON battle_results(winner_fingerprint, loser_fingerprint);
      CREATE TABLE IF NOT EXISTS battle_sessions (
        id UUID PRIMARY KEY,
        state JSONB NOT NULL,
        status TEXT NOT NULL DEFAULT 'active',
        rewarded BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '1 hour'
      );
    `;
    await this.pool.query(schema);
    const legacy = await this.pool.query(`SELECT id, characteristics, powers FROM generated_pokaimon WHERE card_id IS NULL OR stats IS NULL`);
    for (const row of legacy.rows) {
      const parsed = parseLegacyCharacteristics(row.characteristics);
      await this.pool.query(`UPDATE generated_pokaimon SET card_id = COALESCE(card_id, $2), stats = COALESCE(stats, $3::jsonb), unlocked_attacks = CASE WHEN jsonb_array_length(COALESCE(unlocked_attacks, '[]'::jsonb)) = 0 THEN $4::jsonb ELSE unlocked_attacks END WHERE id = $1`, [row.id, crypto.randomUUID(), JSON.stringify(normalizeStats(parsed.stats)), JSON.stringify(normalizeAttacks(row.powers))]);
    }
    console.log('[DB] Schema initialized.');
  }

  async insert(pokemon) {
    const { name, type, powers, characteristics, image_url, doodle_source, stats, source_type = 'generated' } = pokemon;
    const result = await this.pool.query(
      `INSERT INTO generated_pokaimon (name, type, powers, characteristics, image_url, doodle_source, card_id, stats, unlocked_attacks, source_type)
       VALUES ($1, $2, $3::jsonb, $4, $5, $6, $7, $8::jsonb, $3::jsonb, $9)
       RETURNING *`,
      [name, type, JSON.stringify(normalizeAttacks(powers)), characteristics, image_url, doodle_source, crypto.randomUUID(), JSON.stringify(normalizeStats(stats)), source_type]
    );
    return result.rows[0];
  }

  async list() {
    const result = await this.pool.query(
      `SELECT *
       FROM generated_pokaimon
       ORDER BY id DESC`
    );
    return result.rows;
  }

  async like(id) {
    const result = await this.pool.query(
      `UPDATE generated_pokaimon SET like_count = like_count + 1 WHERE id = $1
       RETURNING *`,
      [id]
    );
    return result.rows[0] || null;
  }

  async getById(id) {
    const result = await this.pool.query(
      `SELECT *
       FROM generated_pokaimon WHERE id = $1`,
      [id]
    )
    return result.rows[0] || null
  }

  // Update references to the old name in descriptions as well as the display name.
  // Escape regex characters so a creature name is treated as literal text.
  async rename(id, name) {
    const current = await this.pool.query('SELECT * FROM generated_pokaimon WHERE id = $1', [id]);
    const pal = current.rows[0];
    if (!pal) return null;
    const escaped = String(pal.name).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const oldNamePattern = new RegExp(escaped, 'gi');
    const updateText = (value) => {
      const text = String(value || '');
      const replaced = text.replace(oldNamePattern, name);
      if (replaced !== text) return replaced;
      return text.trim() ? `${name}: ${text}` : `${name} is a one-of-a-kind arena companion.`;
    };
    let characteristics;
    try {
      const parsed = JSON.parse(pal.characteristics);
      characteristics = JSON.stringify({ ...parsed, description: updateText(parsed.description || '') });
    } catch {
      characteristics = updateText(pal.characteristics);
    }
    const updateMoves = (moves) => Array.isArray(moves)
      ? moves.map((move) => ({ ...move, description: updateText(move.description) }))
      : moves;
    const result = await this.pool.query(
      'UPDATE generated_pokaimon SET name = $2, characteristics = $3, powers = $4::jsonb, unlocked_attacks = $5::jsonb WHERE id = $1 RETURNING *',
      [id, name, characteristics, JSON.stringify(updateMoves(pal.powers)), JSON.stringify(updateMoves(pal.unlocked_attacks))],
    );
    return result.rows[0] || null;
  }

  async deleteById(id) {
    const result = await this.pool.query('DELETE FROM generated_pokaimon WHERE id = $1 RETURNING *', [id]);
    return result.rows[0] || null;
  }

  // Look for an earlier rewarded win in this direction; reversing the winner and
  // loser is a different matchup. The route uses this result to suppress repeat XP.
  async hasAwardedWin(winnerFingerprint, loserFingerprint) {
    const result = await this.pool.query(`SELECT 1 FROM battle_results WHERE winner_fingerprint = $1 AND loser_fingerprint = $2 AND xp_awarded > 0 LIMIT 1`, [winnerFingerprint, loserFingerprint]);
    return result.rowCount > 0;
  }

  // Save combatant snapshots and the seed alongside the log for later inspection.
  async recordBattle({ winnerFingerprint, loserFingerprint, winner, loser, seed, log, xpAwarded }) {
    await this.pool.query(`INSERT INTO battle_results (winner_fingerprint, loser_fingerprint, winner_snapshot, loser_snapshot, seed, battle_log, xp_awarded) VALUES ($1,$2,$3::jsonb,$4::jsonb,$5,$6::jsonb,$7)`, [winnerFingerprint, loserFingerprint, JSON.stringify(winner), JSON.stringify(loser), seed, JSON.stringify(log), xpAwarded]);
  }

  async applyProgress(id, pal, xpAwarded) {
    const result = await this.pool.query(`UPDATE generated_pokaimon SET level=$2, xp=$3, unspent_stat_points=$4, battle_wins=battle_wins + CASE WHEN $5 > 0 THEN 1 ELSE 0 END, unlocked_attacks=$6::jsonb, equipped_moves=$6::jsonb, unlocked_moves=$7::jsonb, unlocked_frames=$8::jsonb WHERE id=$1 RETURNING *`, [id, pal.level, pal.xp, pal.unspentStatPoints, xpAwarded, JSON.stringify(pal.attacks), JSON.stringify(pal.unlockedMoves || pal.attacks), JSON.stringify(pal.unlockedFrames || ['starter-linen'])]);
    return result.rows[0] || null;
  }

  // Keep evolution eligibility in the UPDATE condition as well as in route validation.
  async evolve(id) {
    const result = await this.pool.query(`UPDATE generated_pokaimon SET star_level=star_level+1, level=1, xp=0 WHERE id=$1 AND level=5 AND star_level<5 RETURNING *`, [id]);
    return result.rows[0] || null;
  }

  async setMoves(id, moves, inventory) {
    const result = await this.pool.query('UPDATE generated_pokaimon SET equipped_moves=$2::jsonb, unlocked_moves=$3::jsonb WHERE id=$1 RETURNING *', [id, JSON.stringify(moves), JSON.stringify(inventory)]);
    return result.rows[0] || null;
  }

  async setFrame(id, frame, frames) {
    const result = await this.pool.query('UPDATE generated_pokaimon SET selected_frame=$2, unlocked_frames=$3::jsonb WHERE id=$1 RETURNING *', [id, frame, JSON.stringify(frames)]);
    return result.rows[0] || null;
  }

  async updateBattleRecord(id, record, achievements, frames) {
    const result = await this.pool.query('UPDATE generated_pokaimon SET battle_record=$2::jsonb, achievements=$3::jsonb, unlocked_frames=$4::jsonb WHERE id=$1 RETURNING *', [id, JSON.stringify(record), JSON.stringify(achievements), JSON.stringify(frames)]);
    return result.rows[0] || null;
  }

  async createSession(state) {
    const id = crypto.randomUUID();
    const result = await this.pool.query(`INSERT INTO battle_sessions(id,state) VALUES($1,$2::jsonb) RETURNING *`, [id, JSON.stringify(state)]);
    return result.rows[0];
  }

  async getSession(id) {
    const result = await this.pool.query('SELECT * FROM battle_sessions WHERE id=$1', [id]);
    return result.rows[0] || null;
  }

  async updateSession(id, state, status, rewarded = false) {
    const result = await this.pool.query('UPDATE battle_sessions SET state=$2::jsonb,status=$3,rewarded=$4 WHERE id=$1 RETURNING *', [id, JSON.stringify(state), status, rewarded]);
    return result.rows[0] || null;
  }

  // Ignore expired sessions when deciding whether a creature can change its loadout.
  async hasActiveSession(cardId) {
    const result = await this.pool.query(`SELECT 1 FROM battle_sessions WHERE status='active' AND expires_at>NOW() AND state::text LIKE $1 LIMIT 1`, [`%${cardId}%`]);
    return result.rowCount > 0;
  }

  // Use one connection and a transaction for the balance check and stat update.
  // The row lock prevents concurrent allocations from spending the same points.
  async allocateStats(id, allocations) {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const found = await client.query('SELECT * FROM generated_pokaimon WHERE id=$1 FOR UPDATE', [id]);
      const pal = found.rows[0];
      if (!pal) { await client.query('ROLLBACK'); return null; }
      const total = Object.values(allocations).reduce((sum, value) => sum + value, 0);
      if (total > pal.unspent_stat_points) throw new Error('Not enough unspent stat points');
      const stats = normalizeStats(pal.stats);
      const statCeiling = 125 + Math.max(1, Math.min(5, pal.star_level || 1)) * 25;
      for (const [key, value] of Object.entries(allocations)) stats[key] = Math.max(stats[key], Math.min(statCeiling, stats[key] + value));
      // Charge only the increase actually applied, because a stat may hit its ceiling.
      const spent = Object.keys(stats).reduce((sum, key) => sum + (stats[key] - normalizeStats(pal.stats)[key]), 0);
      const result = await client.query('UPDATE generated_pokaimon SET stats=$2::jsonb, unspent_stat_points=unspent_stat_points-$3 WHERE id=$1 RETURNING *', [id, JSON.stringify(stats), spent]);
      await client.query('COMMIT'); return result.rows[0];
    } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
  }

  // Update one power-to-image entry inside JSONB without replacing the entire map.
  async setActionImage(id, powerName, imageUrl) {
    const result = await this.pool.query(
      `UPDATE generated_pokaimon
       SET action_images = jsonb_set(COALESCE(action_images, '{}'::jsonb), $2::text[], to_jsonb($3::text), true)
       WHERE id = $1
       RETURNING *`,
      [id, [powerName], imageUrl]
    )
    return result.rows[0] || null
  }
}
