# Pokee-Pal

Pokee-Pal is a full-stack creature-card application. Draw or upload a creature, generate a card with Cloudflare Workers AI, collect it in the Gallery, customize its moves and frame, and battle other cards in automatic or manual mode.

## Features

- Doodle-to-creature image generation with selectable visual styles
- Ordinary image imports with reproducible stats and moves
- Searchable Gallery with likes, filters, renaming, and deletion
- Automatic and manual turn-based battles
- Move accuracy, type advantages, cooldowns, limited uses, and varied effects
- XP, stat allocation, five-level star progression, achievements, and frames
- Portable PNG cards with embedded Pokee-Pal metadata
- Five cozy color themes

## Technology

- React 19, React Router, Vite, and Tailwind CSS
- Node.js and Express
- PostgreSQL and Memcached
- Cloudflare Workers AI (`FLUX.2 Klein 4B` for images)
- Docker Compose for local infrastructure

## Project structure

```text
.
├── client/              React frontend
├── server/              Express API, battle engine, and tests
├── docs/                Supporting documentation
├── docker-compose.yml   PostgreSQL and Memcached services
└── package.json         Root development commands
```

## Local setup

Requirements: Node.js 20+, npm, and Docker Desktop.

1. Copy the example environment files:

   ```powershell
   Copy-Item server/.env.example server/.env
   Copy-Item client/.env.example client/.env
   ```

2. Add Cloudflare credentials to `server/.env`, or enter them through the app's API panel for the current browser session.

3. Install dependencies:

   ```powershell
   npm run install:all
   ```

4. Start PostgreSQL and Memcached:

   ```powershell
   npm run services:up
   ```

5. In separate terminals, start the API and frontend:

   ```powershell
   npm run dev:server
   npm run dev:client
   ```

Open `http://localhost:5173`. The API runs at `http://localhost:3001`.

## Useful commands

| Command | Purpose |
| --- | --- |
| `npm run dev:client` | Start the Vite frontend |
| `npm run dev:server` | Start the API with file watching |
| `npm test` | Run backend tests and frontend lint |
| `npm run build` | Create the frontend production build |
| `npm run services:down` | Stop local Docker services |

## Environment variables

Backend variables are documented in [`server/.env.example`](server/.env.example). Frontend configuration is in [`client/.env.example`](client/.env.example). Never commit real API tokens or `.env` files.

Cloudflare browser-session credential behavior is described in [`docs/cloudflare-credentials.md`](docs/cloudflare-credentials.md).

## Security note

Portable cards are intentionally unverified in the current version. Their embedded stats can be edited by a technically knowledgeable user and should be treated as casual battle data.
