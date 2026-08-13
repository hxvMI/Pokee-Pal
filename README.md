# Pokee-Pal

[![CI](https://github.com/hxvMI/Pokee-Pal/actions/workflows/ci.yml/badge.svg)](https://github.com/hxvMI/Pokee-Pal/actions/workflows/ci.yml)

Pokee-Pal is a full-stack creature-card game that turns a doodle—or an existing illustration—into a collectible companion. Generate original art and metadata with Cloudflare Workers AI, build a gallery, tune each pal's battle loadout, and compete through automatic simulations or interactive turn-based matches.

> Built as a portfolio project focused on generative AI, portable user-created content, deterministic game systems, persistent progression, and a production-ready React/Express architecture.

## Screenshots

Screenshots are not checked into the repository yet. After starting the app, capture the responsive Generator, Gallery, Battle, and Customize routes and place them in `docs/screenshots/` using `generator.png`, `gallery.png`, `battle.png`, and `customize.png`. This keeps the portfolio page honest while leaving a ready-made showcase checklist.

## Features

- Doodle canvas with brush controls and cute, fierce, realistic, anime, cartoon, and watercolor generation styles
- Cloudflare Workers AI image generation plus structured names, types, descriptions, powers, and stats
- PNG, JPEG, and WebP imports with content validation, deterministic stats, and type-based move sets
- Persistent PostgreSQL gallery with filtering, sorting, likes, renaming, and confirmed deletion
- Automatic seeded battle simulation with reproducible logs
- Manual turn-based battles backed by expiring server sessions
- Type effectiveness, accuracy, evasion, critical hits, recoil, drain, armor piercing, healing, guarding, reflection, cooldowns, and limited move uses
- XP rewards, level progression, allocatable stat points, five-star evolution, achievements, and unlockable card frames
- Custom four-move loadouts with server-enforced availability rules
- Portable PNG battle cards with embedded, versioned Pokee-Pal metadata
- Gallery or uploaded-card combatants and explicit warnings for unverified shared cards
- Generated action scenes for individual powers
- Five persistent visual themes and responsive, route-level lazy-loaded screens
- Optional Memcached gallery caching that degrades safely to PostgreSQL
- Health endpoint, automatic schema initialization, SPA routing fallback, and single-service production serving

## Technology

- React 19, React Router 7, Context API, and browser session/local storage
- Vite 7, Tailwind CSS 3, PostCSS, and ESLint 9
- Node.js 20+ and Express 4
- PostgreSQL with `node-postgres`
- Optional Memcached
- Cloudflare Workers AI
- Node's built-in test runner
- Docker Compose for local PostgreSQL and Memcached
- Render Blueprint for a combined web service

## Architecture

```text
BrowserRouter
└── ThemeProvider
    └── App
        └── CloudflareCredentialsProvider
            └── ErrorBoundary
                ├── Header (navigation, themes, session credentials)
                └── Routes (lazy loaded)
                    ├── /           GeneratorPage
                    ├── /gallery    GalleryPage
                    ├── /battle     BattlePage
                    └── /customize  CustomizePage

Express
├── /api/health
├── /api/gallery and /api/pokaimon/*
├── /api/battles/*
├── /images/*                         generated runtime files
├── PostgreSQL                        cards, progression, battles, sessions
├── Memcached                         optional gallery read cache
├── Cloudflare Workers AI             image and metadata inference
└── /*                                compiled React SPA fallback
```

### Application data flow

```text
Doodle / uploaded image / portable PNG
                  │
                  v
          React route workflow
                  │  JSON or multipart request
                  v
             Express API
        ┌─────────┼───────────┐
        │         │           │
        v         v           v
 Workers AI   battle engine  image storage
        │         │           │
        └────┬────┴───────────┘
             v
         PostgreSQL <----> optional Memcached
             │
             v
      normalized API response
             │
             v
 Gallery / customization / battle UI
             │
             └──> portable PNG export with embedded metadata
```

### Repository layout

```text
.
├── client/                 React/Vite frontend
│   ├── src/components/     reusable UI and battle presentation
│   ├── src/context/        theme and temporary Cloudflare credentials
│   ├── src/hooks/          gallery request lifecycle
│   ├── src/pages/          routed feature workflows
│   └── src/utils/          API URLs and portable-card encoding
├── server/
│   ├── scripts/            client build/copy automation
│   ├── sql/                reference schema
│   ├── src/                API, database, AI, cache, storage, battle logic
│   ├── test/               automatic and manual battle tests
│   └── public/             built SPA plus runtime image directory
├── docs/                   deployment, cache, and credential guidance
├── docker-compose.yml      local PostgreSQL and Memcached
├── render.yaml             one-service Render Blueprint
└── package.json            repository-wide commands
```

Route pages own feature-specific interaction state. `usePalGallery` centralizes gallery loading, contexts manage cross-route browser state, and `utils/api.js` chooses either an explicit development API origin or same-origin production requests. Express validates inputs, delegates battle rules to pure engine modules, persists canonical state in PostgreSQL, and serves the compiled client.

## Download, configure, and run

### Prerequisites

- [Node.js](https://nodejs.org/) 20 or newer (npm is included)
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) for the easiest local database/cache setup, or an existing PostgreSQL instance
- A Cloudflare account with Workers AI access for AI generation
- Git if cloning instead of downloading a ZIP

Confirm the local tools:

```bash
node --version
npm --version
docker --version
```

### 1. Download the repository

Choose **Code > Download ZIP** on GitHub and extract it, or clone it:

```bash
git clone <your-repository-url>
cd Pokee-Pal
```

Run root commands from the directory containing `client/`, `server/`, and the root `package.json`.

### 2. Install dependencies

```bash
npm run install:all
```

### 3. Create local environment files

PowerShell:

```powershell
Copy-Item server/.env.example server/.env
Copy-Item client/.env.example client/.env
```

Bash:

```bash
cp server/.env.example server/.env
cp client/.env.example client/.env
```

### 4. Configure environment variables

`server/.env`:

| Variable | Required | Purpose |
| --- | --- | --- |
| `PORT` | No | Express port; defaults to `3001` and is assigned by Render in production |
| `DATABASE_URL` | Yes | PostgreSQL connection URL; startup fails fast if unavailable |
| `CORS_ORIGIN` | No | Allowed frontend origin; use `http://localhost:5173` locally |
| `CLOUDFLARE_ACCOUNT_ID` | For server-side AI | Cloudflare account that owns Workers AI access |
| `CLOUDFLARE_API_TOKEN` | For server-side AI | Scoped token allowed to invoke Workers AI |
| `CACHE_ENABLED` | No | Set `false` when Memcached is unavailable |
| `MEMCACHED_SERVERS` | When cache enabled | Memcached address; defaults to `localhost:11211` |

`client/.env`:

| Variable | Required | Purpose |
| --- | --- | --- |
| `VITE_BACKEND_URL` | Local split-server only | API origin such as `http://localhost:3001`; omit for a same-origin production build |

The header can accept Cloudflare credentials for one browser session. They are stored in `sessionStorage` and sent only with generation requests. Server environment variables are strongly preferred for a private production deployment. Restart Vite or rebuild after changing a `VITE_` variable.

### 5. Start local infrastructure

```bash
npm run services:up
```

Docker Compose starts PostgreSQL on `5432` and Memcached on `11211`. The API also initializes and migrates its PostgreSQL schema idempotently during startup.

### 6. Start the application

Run these in separate terminals from the repository root:

```bash
npm run dev:server
npm run dev:client
```

Open `http://localhost:5173`. The local Vite client uses the API configured in `client/.env`, normally `http://localhost:3001`.

To stop infrastructure after development:

```bash
npm run services:down
```

### Common setup problems

- **Database startup fails** — verify Docker is running, port `5432` is available, and `DATABASE_URL` matches the active database.
- **Generation requests fail** — verify the Cloudflare account ID, token scope, Workers AI access, and current quota.
- **Gallery works but caching logs errors** — start Memcached or set `CACHE_ENABLED=false`; PostgreSQL remains the source of truth.
- **The deployed client calls localhost** — rebuild without `VITE_BACKEND_URL`; an unset value intentionally uses the deployed origin.
- **A direct client route returns 404** — run `npm run build:deploy` so `server/public/app/index.html` exists before starting Express.

## Available npm commands

| Command | Purpose |
| --- | --- |
| `npm run install:all` | Install client and server dependencies |
| `npm run dev:client` | Start Vite with hot reload |
| `npm run dev:server` | Start Express with Node file watching |
| `npm run build` | Build the client into `client/dist` |
| `npm run build:deploy` | Build and copy the client into `server/public/app` |
| `npm start` | Start the production Express server |
| `npm test` | Run server tests, then frontend lint |
| `npm run check` | Run tests, lint, and the production client build |
| `npm run services:up` | Start local PostgreSQL and Memcached |
| `npm run services:down` | Stop the Docker Compose services |

Client-only commands such as `npm run preview --prefix client` and server-only commands such as `npm test --prefix server` are also available.

## Testing and quality checks

Server tests use Node's built-in runner and focus on the rule-heavy paths with the highest regression risk:

- deterministic seeded automatic battles
- normalization, type matchups, move effects, progression, and rewards
- manual move availability, cooldowns, limited uses, round resolution, and completion

Run checks individually:

```bash
npm test --prefix server
npm run lint --prefix client
npm run build:deploy
```

Or run the standard repository gate:

```bash
npm run check
```

The current suite does not include browser component or end-to-end tests; those are documented below as future work.

## Free deployment with Render and Neon

The checked-in `render.yaml` defines one free Render Node web service. Its build installs both workspaces and copies the Vite bundle into Express; its start command launches the API, which serves the SPA and `/api` from one origin.

1. Create a PostgreSQL project in [Neon](https://neon.com/) and copy its pooled connection string.
2. Commit this repository to your own Git host when ready.
3. In [Render](https://render.com/), create a Blueprint from the repository. Do not deploy until you are ready to create external resources.
4. Supply the secret `DATABASE_URL`, `CLOUDFLARE_ACCOUNT_ID`, and `CLOUDFLARE_API_TOKEN` values requested by the Blueprint.
5. Keep `CACHE_ENABLED=false` unless you provision a network-accessible Memcached service.
6. Leave `VITE_BACKEND_URL` unset. The browser will call its current Render origin.
7. After startup, verify `/api/health`, then exercise generation, gallery persistence, and both battle modes.

No separate migration command is required: the server initializes its schema before listening. Render's free instances can restart or spin down, so first requests may be slow and runtime disk contents are not durable.

### Generated-image storage limitation

Generated and imported images are currently written to `server/public/images`. This is local runtime filesystem storage and is ephemeral on a free Render web service: database rows can survive in Neon while their corresponding image files disappear after a restart or redeploy. Treat the current deployment as a demo until image storage moves to a persistent object service such as Cloudflare R2, Amazon S3, or Supabase Storage.

## Security notes

- Never commit `.env` files, database credentials, or Cloudflare tokens.
- Prefer narrowly scoped server-side Cloudflare credentials; browser-session credentials are readable by JavaScript running on the page.
- Uploaded images are restricted by MIME type, signature, and size, but production deployments should also add malware scanning and stronger image decoding.
- Portable cards are deliberately unverified. Embedded stats can be edited and must be treated as casual, user-supplied battle data.
- A public deployment still needs authentication, authorization for mutations, request rate limiting, abuse controls, and CSRF/origin review.
- Restrict `CORS_ORIGIN` when the API and client are hosted separately. Same-origin deployment does not require a public wildcard.
- Report vulnerabilities privately as described in [SECURITY.md](SECURITY.md).

## Future improvements

- Move generated images to durable object storage and clean up orphaned objects transactionally
- Add authentication, per-user collections, ownership checks, and private cards
- Sign portable-card metadata and provide trusted versus casual battle queues
- Add API rate limiting, structured request validation, audit logs, and observability
- Add React Testing Library coverage and Playwright end-to-end tests for generation, gallery, customization, and battles
- Persist and resume manual battles in the interface after a browser refresh
- Add gallery search, pagination, optimistic rollback, and background revalidation
- Queue AI jobs and expose progress for slower generation requests
- Add database migrations instead of relying only on startup schema reconciliation
- Capture and maintain portfolio screenshots plus mobile interaction recordings

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for the local quality gate and pull-request expectations.

## License

This repository is intended for educational and portfolio use. Add a license file before accepting external reuse or distribution.
