import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import multer from 'multer';
import crypto from 'crypto';
import { Database } from './db.js';
import { generateImageFromDoodle, generatePalMetadata, generateActionImage } from './ai.js';
import cache from './cache.js';
import { deleteImage, saveBase64Image, saveImageBuffer } from './imageStorage.js';
import { applyXp, buildPortablePal, equippedMovesFor, framesFor, moveInventoryFor, normalizeStats, simulateBattle, STAT_KEYS } from './battle.js';
import { availableMoves, createManualBattle, resolveManualRound } from './manualBattle.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;
const CORS_ORIGIN = process.env.CORS_ORIGIN || '*';

app.use(cors({ origin: CORS_ORIGIN }));
app.use(express.json({ limit: '4mb' }));
app.use('/images', express.static('public/images'));
app.use(express.static('public/app'));
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 }, fileFilter: (_req, file, callback) => callback(null, ['image/png', 'image/jpeg', 'image/webp'].includes(file.mimetype)) });
const PAL_TYPES = ['Normal', 'Fire', 'Water', 'Grass', 'Electric', 'Ice', 'Fighting', 'Poison', 'Ground', 'Flying', 'Psychic', 'Bug', 'Rock', 'Ghost', 'Dragon', 'Dark', 'Steel', 'Fairy'];

function validImageBytes(buffer, mime) {
  if (mime === 'image/png') return buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  if (mime === 'image/jpeg') return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  if (mime === 'image/webp') return buffer.subarray(0, 4).toString() === 'RIFF' && buffer.subarray(8, 12).toString() === 'WEBP';
  return false;
}

let db;
try {
  db = new Database({ url: process.env.DATABASE_URL });
  await db.connect();
  await db.initialize();
} catch (err) {
  console.error('[DB] Startup failed:', err.message);
  process.exit(1);
}

async function resolveCombatant(requestedPal) {
  if (requestedPal?.id != null) {
    const stored = await db.getById(Number(requestedPal.id));
    if (!stored) throw new Error(`Gallery pal ${requestedPal.id} was not found`);
    return buildPortablePal(stored);
  }
  if (requestedPal?.format !== 'pokee-pal-card' || ![1, 2].includes(Number(requestedPal.version))) throw new Error('A valid Pokee-Pal card is required');
  return buildPortablePal(requestedPal, { imported: true });
}

function achievementUpdate(pal, log, won, finalHealth) {
  const record = { wins: 0, losses: 0, damage: 0, healing: 0, blocked: 0, reflected: 0, evasions: 0, criticals: 0, ...(pal.battleRecord || {}) };
  const actions = log.filter((entry) => entry.attacker === pal.cardId);
  const defended = log.filter((entry) => entry.defender === pal.cardId);
  if (won) record.wins += 1; else record.losses += 1;
  record.damage += actions.reduce((sum, entry) => sum + (entry.damage || 0), 0);
  record.healing += actions.filter((entry) => entry.kind === 'heal').reduce((sum, entry) => sum + (entry.amount || 0), 0);
  record.blocked += defended.reduce((sum, entry) => sum + (entry.blocked || 0), 0);
  record.reflected += defended.reduce((sum, entry) => sum + (entry.reflected || 0), 0);
  record.evasions += defended.filter((entry) => entry.evaded).length;
  record.criticals += actions.filter((entry) => entry.critical).length;
  const achievements = { ...(pal.achievements || {}) };
  if (record.wins >= 1) achievements['first-victory'] = true;
  if (record.wins >= 5) achievements.veteran = true;
  if (record.wins >= 10) achievements.champion = true;
  if (defended.filter((entry) => entry.evaded).length >= 5) achievements.windrunner = true;
  if (won && (finalHealth?.[pal.cardId] || 0) <= pal.stats.health * 0.1) achievements['close-call'] = true;
  const kinds = new Set(actions.map((entry) => entry.kind));
  if (['attack', 'heal', 'block', 'reflect'].every((kind) => kinds.has(kind))) achievements.tactician = true;
  if (won && [...actions].reverse().find((entry) => entry.kind === 'attack')?.effectiveness > 1) achievements['type-triumph'] = true;
  if (pal.starLevel === 5 && pal.level === 5) achievements['max-potential'] = true;
  return { record, achievements, frames: framesFor({ ...pal, battle_record: record, achievements }) };
}

async function persistBattleRecords(result) {
  for (const pal of [result.winner, result.loser]) {
    if (!pal.id) continue;
    const latest = buildPortablePal(await db.getById(pal.id));
    const update = achievementUpdate(latest, result.log, pal.cardId === result.winner.cardId, result.finalHealth);
    await db.updateBattleRecord(pal.id, update.record, update.achievements, update.frames);
  }
}

app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

// Gallery endpoint with Memcached caching
app.get('/api/gallery', async (_req, res) => {
  try {
    const rows = await cache.getOrSet('gallery:all', () => db.list(), 300);
    res.json(rows.map((row) => {
      const portable = buildPortablePal(row);
      return { ...row, ...portable, image_url: row.image_url, card_id: row.card_id };
    }));
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to fetch gallery' });
  }
});

app.post('/api/generate', async (req, res) => {
  try {
    const { doodle_data, cloudflare_account_id, cloudflare_api_token, pal_style } = req.body || {};
    if (!doodle_data || typeof doodle_data !== 'string') {
      return res.status(400).json({ error: 'doodle_data (base64) is required' });
    }

    const credentials  = {
      accountId: cloudflare_account_id,
      apiToken: cloudflare_api_token,
    };
    const allowedStyles = ['cute', 'fierce', 'realistic', 'anime', 'cartoon', 'watercolor'];
    const palStyle = allowedStyles.includes(pal_style) ? pal_style : 'cute';

    try {
      // Attempt real AI generation if configured
      // 1) Generate the base image from the doodle
      const imgB64 = await generateImageFromDoodle(doodle_data, credentials, palStyle);

      // Save image as file instead of using data URL
      const imageUrl = saveBase64Image(imgB64, 'pokemon');

      // 2) Generate metadata using the produced image as reference for higher accuracy
      const meta = await generatePalMetadata(
        'Design an original battle-creature matching the generated arena creature. Use allowed types and include the name in each power description.',
        credentials,
        palStyle
      );

      const name = (meta?.name || 'Sketchy').toString()
      const normalizedPowers = Array.isArray(meta?.powers) && meta.powers.length
        ? meta.powers.map((p) => ({ name: p.name, description: p.description }))
        : [
            { name: 'Ink Splash', description: `${name} sweeps a bright ribbon of enchanted ink across the arena, obscuring the rival before the colorful splash lands.` },
            { name: 'Doodle Dash', description: `${name} darts through its own sketched doorway and reappears from an unexpected angle in a whirlwind of scribbled motion lines.` },
          ];

      // Ensure power descriptions use the generated name explicitly
      const powersWithName = normalizedPowers.map((p) => {
        const desc = (p.description || '').toString()
        const hasName = new RegExp(`\\b${name}\\b`, 'i').test(desc)
        const replaced = desc.replace(/\b(the user|the creature|the character)\b/gi, name)
        const expand = (value) => value.length >= 80 ? value : `${value} The move leaves a distinctive burst of ${name}'s imaginative energy across the arena.`
        if (hasName) return { ...p, description: expand(replaced) }
        // If name not present, prepend it for clarity
        const trimmed = replaced.trim()
        const lower = trimmed.charAt(0).toLowerCase() + trimmed.slice(1)
        return { ...p, description: expand(`${name} ${lower}`) }
      })

      const rawCharacteristics = meta?.characteristics
      const description = typeof rawCharacteristics === 'string'
        ? rawCharacteristics
        : (rawCharacteristics?.description || `${name} is a cheerful, imaginative companion whose hand-drawn markings shimmer whenever a new idea strikes. Curious and slightly mischievous, this pal collects colorful scraps after every friendly match.`)
      const rawStats = meta?.stats || (
        rawCharacteristics && typeof rawCharacteristics === 'object'
          ? rawCharacteristics.stats || rawCharacteristics
          : null
      )
      const statNames = ['attack', 'defense', 'health', 'speed']
      const stats = rawStats && typeof rawStats === 'object'
        ? Object.fromEntries(statNames
            .filter((key) => Number.isFinite(Number(rawStats[key])))
            .map((key) => [key, Math.max(1, Math.min(150, Math.round(Number(rawStats[key]))))]))
        : { attack: 75, defense: 75, health: 100, speed: 75 }
      for (const [key, fallback] of Object.entries({ attack: 75, defense: 75, health: 100, speed: 75 })) {
        if (!Number.isFinite(Number(stats[key]))) stats[key] = fallback;
      }
      const expandedDescription = description.length >= 100
        ? description
        : `${description} ${name} has expressive details and a memorable habit of turning every quiet moment into a small creative adventure.`
      const characteristics = JSON.stringify({ description: expandedDescription, stats })

      const pokemon = {
        name,
        type: Array.isArray(meta?.type) && meta.type.length
          ? meta.type.slice(0, 2).join('/')
          : (typeof meta?.type === 'string' ? meta.type : 'Normal'),
        powers: powersWithName,
        characteristics,
        image_url: imageUrl, // File path instead of data URL
        doodle_source: (doodle_data || '').slice(0, 60) + '...',
        stats,
      };
      const saved = await db.insert(pokemon);

      // Update the Gallery cache without another database read.
      const cached = await cache.get('gallery:all');
      if (cached && Array.isArray(cached)) {
        cached.unshift(saved); // Add to beginning (newest first)
        await cache.set('gallery:all', cached, 300);
        console.log('Cache updated: gallery:all in insert')
      }

      return res.json(saved);
    } catch (aiErr) {
      // A placeholder looks like a successful generation to the client and hides
      // actionable errors such as an invalid key, quota exhaustion, or a retired
      // model. Return an error so the UI can tell the user what needs attention.
      console.error('[AI] Generation failed:', aiErr);
      const message = aiErr?.message || 'Unknown Workers AI error';
      return res.status(502).json({
        error: `Image generation failed: ${message}`,
      });
    }
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to generate' });
  }
});

app.patch('/api/pokaimon/:id/like', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid id' });
    const updated = await db.like(id);
    if (!updated) return res.status(404).json({ error: 'Not found' });

    // Update the pal in cache without another database read.
    const cached = await cache.get('gallery:all');
    if (cached && Array.isArray(cached)) {
      const index = cached.findIndex(p => p.id === id);
      if (index !== -1) {
        cached[index] = updated;
        await cache.set('gallery:all', cached, 300);
        console.log(`Cache updated: Pokee-Pal #${id} in gallery:all`);
      }
    }

    res.json(updated);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to like' });
  }
});

app.patch('/api/pokaimon/:id/name', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const name = typeof req.body?.name === 'string' ? req.body.name.trim().replace(/\s+/g, ' ') : '';
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid id' });
    if (name.length < 2 || name.length > 40) return res.status(400).json({ error: 'Names must be between 2 and 40 characters' });
    const updated = await db.rename(id, name);
    if (!updated) return res.status(404).json({ error: 'Pal not found' });
    await cache.del('gallery:all');
    res.json(updated);
  } catch (error) {
    console.error('[Rename] Failed:', error);
    res.status(500).json({ error: 'Failed to rename pal' });
  }
});

app.delete('/api/pokaimon/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid id' });
    const deleted = await db.deleteById(id);
    if (!deleted) return res.status(404).json({ error: 'Pal not found' });
    deleteImage(deleted.image_url);
    for (const actionImage of Object.values(deleted.action_images || {})) deleteImage(actionImage);
    await cache.del('gallery:all');
    res.json({ deleted: true, id });
  } catch (error) {
    console.error('[Delete] Failed:', error);
    res.status(500).json({ error: 'Failed to delete pal' });
  }
});

app.post('/api/battles/simulate', async (req, res) => {
  try {
    const requested = [req.body?.left, req.body?.right];
    if (requested.some((pal) => !pal || typeof pal !== 'object')) {
      return res.status(400).json({ error: 'left and right combatants are required' });
    }

    const combatants = [];
    for (const requestedPal of requested) {
      if (requestedPal.id != null) {
        const id = Number(requestedPal.id);
        if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid gallery pal id' });
        const stored = await db.getById(id);
        if (!stored) return res.status(404).json({ error: `Gallery pal ${id} was not found` });
        combatants.push(buildPortablePal(stored));
      } else {
        if (requestedPal.format !== 'pokee-pal-card' || Number(requestedPal.version) !== 1) {
          return res.status(400).json({ error: 'Uploaded combatants must be Pokee-Pal card version 1' });
        }
        combatants.push(buildPortablePal(requestedPal, { imported: true }));
      }
    }
    if (combatants[0].cardId === combatants[1].cardId) {
      return res.status(400).json({ error: 'Choose two different Pokee-Pals' });
    }

    const requestedSeed = Number(req.body?.seed);
    const seed = Number.isInteger(requestedSeed) && requestedSeed > 0 ? requestedSeed : undefined;
    const battle = simulateBattle(combatants[0], combatants[1], seed);
    const alreadyAwarded = await db.hasAwardedWin(battle.winner.cardId, battle.loser.cardId);
    const xpAwarded = alreadyAwarded ? 0 : 50;
    let updatedWinner = battle.winner;
    let levelsGained = 0;
    if (xpAwarded) {
      const progress = applyXp(battle.winner, xpAwarded);
      updatedWinner = progress.pal;
      levelsGained = progress.levelsGained;
      if (battle.winner.id) await db.applyProgress(battle.winner.id, updatedWinner, xpAwarded);
    }
    await db.recordBattle({ winnerFingerprint: battle.winner.cardId, loserFingerprint: battle.loser.cardId, winner: updatedWinner, loser: battle.loser, seed: battle.seed, log: battle.log, xpAwarded });
    await persistBattleRecords({ ...battle, winner: updatedWinner });
    if (battle.winner.id && xpAwarded) await cache.del('gallery:all');

    res.json({ ...battle, winner: updatedWinner, xpAwarded, levelsGained, rematch: alreadyAwarded });
  } catch (error) {
    console.error('[Battle] Simulation failed:', error);
    res.status(500).json({ error: 'Failed to simulate battle' });
  }
});

app.post('/api/pokaimon/:id/allocate-stats', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid id' });
    const source = req.body?.allocations || {};
    const allocations = Object.fromEntries(STAT_KEYS.map((key) => {
      const value = Number(source[key] || 0);
      return [key, Number.isInteger(value) && value >= 0 ? value : -1];
    }));
    if (Object.values(allocations).some((value) => value < 0)) {
      return res.status(400).json({ error: 'Allocations must be non-negative whole numbers' });
    }
    const updated = await db.allocateStats(id, allocations);
    if (!updated) return res.status(404).json({ error: 'Pal not found' });
    await cache.del('gallery:all');
    res.json(buildPortablePal(updated));
  } catch (error) {
    const status = error.message === 'Not enough unspent stat points' ? 400 : 500;
    res.status(status).json({ error: error.message || 'Failed to allocate stats' });
  }
});

app.post('/api/pokaimon/:id/evolve', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const current = await db.getById(id);
    if (!current) return res.status(404).json({ error: 'Pal not found' });
    if (current.star_level >= 5) return res.status(400).json({ error: 'This pal already has five stars' });
    if (current.level < 5) return res.status(400).json({ error: 'This pal must reach level 5 before evolving' });
    let updated = await db.evolve(id);
    const portable = buildPortablePal(updated);
    updated = await db.setFrame(id, updated.selected_frame, portable.unlockedFrames);
    await cache.del('gallery:all');
    res.json(buildPortablePal(updated));
  } catch (error) { console.error(error); res.status(500).json({ error: 'Failed to evolve pal' }); }
});

app.patch('/api/pokaimon/:id/moves', async (req, res) => {
  try {
    const id = Number(req.params.id); const stored = await db.getById(id);
    if (!stored) return res.status(404).json({ error: 'Pal not found' });
    const portable = buildPortablePal(stored);
    if (await db.hasActiveSession(portable.cardId)) return res.status(409).json({ error: 'Moves cannot change during an active battle' });
    const names = Array.isArray(req.body?.moves) ? req.body.moves.map(String) : [];
    if (names.length !== 4 || new Set(names.map((name) => name.toLowerCase())).size !== 4) return res.status(400).json({ error: 'Choose four different moves' });
    const inventory = moveInventoryFor(stored); const byName = new Map(inventory.map((move) => [move.name.toLowerCase(), move]));
    const moves = names.map((name) => byName.get(name.toLowerCase()));
    if (moves.some((move) => !move)) return res.status(400).json({ error: 'One or more moves are locked' });
    if (!moves.some((move) => move.name === 'Cozy Guard')) return res.status(400).json({ error: 'Cozy Guard must remain equipped' });
    const updated = await db.setMoves(id, moves, inventory); await cache.del('gallery:all'); res.json(buildPortablePal(updated));
  } catch (error) { console.error(error); res.status(500).json({ error: 'Failed to equip moves' }); }
});

app.patch('/api/pokaimon/:id/frame', async (req, res) => {
  try {
    const id = Number(req.params.id); const stored = await db.getById(id);
    if (!stored) return res.status(404).json({ error: 'Pal not found' });
    const frames = framesFor(stored); const frame = String(req.body?.frame || '');
    if (!frames.includes(frame)) return res.status(400).json({ error: 'That frame is still locked' });
    const updated = await db.setFrame(id, frame, frames); await cache.del('gallery:all'); res.json(buildPortablePal(updated));
  } catch (error) { console.error(error); res.status(500).json({ error: 'Failed to equip frame' }); }
});

app.post('/api/pokaimon/import', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'A PNG, JPEG, or WebP image is required' });
    const name = String(req.body?.name || '').trim(); const type = String(req.body?.type || 'Normal').trim();
    if (name.length < 2 || name.length > 40) return res.status(400).json({ error: 'Names must be between 2 and 40 characters' });
    if (!validImageBytes(req.file.buffer, req.file.mimetype)) return res.status(400).json({ error: 'The uploaded file contents do not match its image type' });
    const selectedTypes = type.split('/').map((item) => item.trim());
    if (selectedTypes.length > 2 || selectedTypes.some((item) => !PAL_TYPES.includes(item))) return res.status(400).json({ error: 'Choose one or two valid creature types' });
    const seed = crypto.createHash('sha256').update(req.file.buffer).digest();
    const stats = { attack: 55 + seed[0] % 66, defense: 55 + seed[1] % 66, health: 70 + seed[2] % 51, speed: 55 + seed[3] % 66 };
    const imageUrl = saveImageBuffer(req.file.buffer, req.file.mimetype, 'imported');
    const description = String(req.body?.description || `${name} is a newly discovered ${type.toLowerCase()} companion with an adventurous spirit.`).slice(0, 300);
    const saved = await db.insert({ name, type, powers: [], characteristics: JSON.stringify({ description, stats }), stats, image_url: imageUrl, doodle_source: 'uploaded image', source_type: 'uploaded' });
    await cache.del('gallery:all'); res.status(201).json(buildPortablePal(saved));
  } catch (error) { console.error(error); res.status(error.code === 'LIMIT_FILE_SIZE' ? 413 : 500).json({ error: error.message || 'Failed to import pal' }); }
});

app.post('/api/battles/manual', async (req, res) => {
  try {
    const left = await resolveCombatant(req.body?.left); const right = await resolveCombatant(req.body?.right);
    if (left.cardId === right.cardId) return res.status(400).json({ error: 'Choose two different Pokee-Pals' });
    const state = createManualBattle(left, right); const session = await db.createSession(state);
    res.status(201).json({ sessionId: session.id, state, availableMoves: availableMoves(state, 0) });
  } catch (error) { res.status(400).json({ error: error.message }); }
});

app.get('/api/battles/:sessionId', async (req, res) => {
  const session = await db.getSession(req.params.sessionId);
  if (!session) return res.status(404).json({ error: 'Battle session not found' });
  if (new Date(session.expires_at) <= new Date()) return res.status(410).json({ error: 'Battle session expired' });
  res.json({ sessionId: session.id, state: session.state, availableMoves: session.status === 'active' ? availableMoves(session.state, 0) : [] });
});

app.post('/api/battles/:sessionId/action', async (req, res) => {
  try {
    const session = await db.getSession(req.params.sessionId);
    if (!session) return res.status(404).json({ error: 'Battle session not found' });
    if (new Date(session.expires_at) <= new Date()) return res.status(410).json({ error: 'Battle session expired' });
    const state = resolveManualRound(session.state, String(req.body?.move || ''));
    let rewarded = session.rewarded;
    if (state.status === 'complete' && !rewarded) {
      const already = await db.hasAwardedWin(state.winner.cardId, state.loser.cardId); const xpAwarded = already ? 0 : 50;
      if (xpAwarded && state.winner.id) { const progress = applyXp(state.winner, xpAwarded); state.winner = progress.pal; await db.applyProgress(state.winner.id, state.winner, xpAwarded); }
      state.xpAwarded = xpAwarded; state.rematch = already;
      await db.recordBattle({ winnerFingerprint: state.winner.cardId, loserFingerprint: state.loser.cardId, winner: state.winner, loser: state.loser, seed: state.seed, log: state.log, xpAwarded });
      await persistBattleRecords(state); rewarded = true; await cache.del('gallery:all');
    }
    await db.updateSession(session.id, state, state.status, rewarded);
    res.json({ sessionId: session.id, state, availableMoves: state.status === 'active' ? availableMoves(state, 0) : [] });
  } catch (error) { res.status(400).json({ error: error.message }); }
});

app.delete('/api/battles/:sessionId', async (req, res) => {
  const session = await db.getSession(req.params.sessionId);
  if (!session) return res.status(404).json({ error: 'Battle session not found' });
  if (session.status === 'active') await db.updateSession(session.id, session.state, 'cancelled', session.rewarded);
  res.json({ cancelled: true });
});

app.use((error, _req, res, next) => {
  if (error instanceof multer.MulterError) return res.status(error.code === 'LIMIT_FILE_SIZE' ? 413 : 400).json({ error: error.code === 'LIMIT_FILE_SIZE' ? 'Images must be 5 MB or smaller' : error.message });
  next(error);
});

app.post('/api/pokaimon/:id/action-image', async (req, res) => {
  try {
    const id = Number(req.params.id)
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid id' })
    const { power, force, cloudflare_account_id, cloudflare_api_token } = req.body || {}
    const credentials = {
      accountId: cloudflare_account_id,
      apiToken: cloudflare_api_token,
    }
    const powerName = typeof power === 'string' ? power : power?.name
    const powerDesc = typeof power === 'object' ? power?.description : undefined
    if (!powerName) return res.status(400).json({ error: 'power (name) required' })

    const pokemon = await db.getById(id)
    if (!pokemon) return res.status(404).json({ error: 'Not found' })

    const cached = pokemon.action_images?.[powerName]
    if (cached && !force) {
      return res.json({ image_url: cached, cached: true })
    }

    const b64 = await generateActionImage(
      {
        baseImageDataUrl: pokemon.image_url.startsWith('/images/')
          ? `http://localhost:${PORT}${pokemon.image_url}`
          : pokemon.image_url,
        name: pokemon.name,
        type: pokemon.type,
        characteristics: pokemon.characteristics,
      },
      { name: powerName, description: powerDesc },
      credentials
    )

    // Save as file instead of data URL
    const actionImageUrl = saveBase64Image(b64, 'action')
    const updated = await db.setActionImage(id, powerName, actionImageUrl)
    return res.json({ image_url: actionImageUrl, cached: false })
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'Failed to generate action image' })
  }
})

// SPA fallback for React Router
// Serve index.html for all routes that don't match API or static files
// MUST be the last route, after all API routes
app.get('*', (req, res) => {
  // Don't fallback for API routes or file extensions
  if (req.path.startsWith('/api/') || req.path.includes('.')) {
    return res.status(404).send('Not found');
  }
  res.sendFile('public/app/index.html', { root: '.' });
});

app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
