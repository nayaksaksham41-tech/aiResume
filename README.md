# CVA — AI Resume Studio

Express.js app: tailor resumes to a job description with AI, ATS-style score, PDF & Word export, accounts (JSON file DB), optional admin dashboard.

## Quick start (local)

```bash
npm install
cp .env.example .env
```

Edit `.env` with at least one AI provider key and `JWT_SECRET` (any long random string). Then:

```bash
npm run dev
```

Open `http://localhost:3000`.

## Environment variables

Copy from [`.env.example`](./.env.example). Never commit `.env` or API keys.

- **Production:** set `JWT_SECRET`, `NODE_ENV=production`, your AI keys, and **`PUPPETEER_NO_SANDBOX=true`** on cloud servers.
- **`OPENROUTER_HTTP_REFERER`** should match your **public site URL** (required by some providers).

## Push to GitHub

1. Confirm secrets are **not** tracked:
   ```bash
   git status
   ```
   You should **not** see `.env` or `data/`.

2. Initialize and commit (first time only):
   ```bash
   git init
   git add .
   git commit -m "Initial commit: AI resume studio"
   ```

3. Create a new empty repository on [GitHub](https://github.com/new) (no README/license if you already have files locally).

4. Add the remote and push (replace `YOUR_USER` / `YOUR_REPO`):
   ```bash
   git branch -M main
   git remote add origin https://github.com/YOUR_USER/YOUR_REPO.git
   git push -u origin main
   ```

If you use SSH: `git@github.com:YOUR_USER/YOUR_REPO.git`

## Hosting (recommended: Render or Railway)

For a **real Express backend**, prefer **Render** or **Railway**: one long‑running **`npm start`** process — routing, auth cookies, and **`public/`** assets behave like **localhost**. No Vercel‑specific routing.

**Vercel** is optional: serverless Express works but has stricter limits (PDF runtime, ephemeral `/tmp` data). Use it only if you explicitly want serverless.

Good fits with free/low tiers: **Render**, **Railway**, **Fly.io** (cold starts / caps vary).

### Render (free tier — step by step)

1. Sign up at [render.com](https://render.com) (GitHub login is easiest).
2. **Dashboard → New + → Web Service** → **Connect** your GitHub repo (authorize Render if asked).
3. Configure the service:

   | Field | Value |
   |--------|--------|
   | **Name** | anything (e.g. `cva-resume`) |
   | **Region** | closest to you |
   | **Branch** | `main` |
   | **Root directory** | *(leave empty)* |
   | **Runtime** | `Node` |
   | **Build command** | `npm install` |
   | **Start command** | `npm start` |
   | **Instance type** | **Free** |

4. Under **Advanced**, set **Health check path** to `/health` (optional but recommended).
5. Under **Environment**, add your secrets (never commit these to Git):

   | Key | Value |
   |-----|--------|
   | `NODE_ENV` | `production` |
   | `JWT_SECRET` | Long random string (32+ characters) |
   | `PUPPETEER_NO_SANDBOX` | `true` |
   | `AI_PROVIDER` | `openrouter` (or your provider) |
   | `OPENROUTER_API_KEY` | your key |
   | `OPENROUTER_MODEL` | e.g. `openai/gpt-4o-mini` |
   | `OPENROUTER_HTTP_REFERER` | After deploy: `https://YOUR-SERVICE.onrender.com` (your exact URL) |
   | `OPENROUTER_APP_NAME` | any label, e.g. `resume-api` |

   Copy anything else you need from [`.env.example`](./.env.example) (Groq, Gemini, `ADMIN_EMAIL`, etc.).

6. **Create Web Service.** First build may take several minutes (`npm install` + Puppeteer downloading Chromium).
7. When status is **Live**, open your `.onrender.com` URL. Update **`OPENROUTER_HTTP_REFERER`** to match that URL, then **Save** (triggers redeploy). OpenRouter expects this referer.

Optional: [`render.yaml`](./render.yaml) defines the web service, **`/health`**, and non-secret env; add secrets in the Render dashboard.

**Cold starts:** Free Web Services sleep after idle time; the first request after sleep can take ~30–60 seconds.

### Railway

Same idea as Render: deploy the repo as a **Node** web service. The repo includes [`railway.toml`](./railway.toml) with **`npm start`**.

1. [railway.app](https://railway.app) → **New project** → **Deploy from GitHub** → pick this repo.
2. Nixpacks will **`npm install`**; start command is **`npm start`** (from `railway.toml` / `package.json`).
3. **Variables** tab: add the **same keys** as in the Render table (`NODE_ENV`, `JWT_SECRET`, OpenRouter keys, `PUPPETEER_NO_SANDBOX=true`). Set **`OPENROUTER_HTTP_REFERER`** to your Railway **public URL** after you create it.
4. **Settings → Networking → Generate domain**, open the URL, then fix **`OPENROUTER_HTTP_REFERER`** if needed and redeploy.

### Vercel (serverless, optional)

This repo targets Vercel’s **native Express** integration: export **`server.js`** as the app (`module.exports = app`), **`npm run build`** (bundle check only), and PDFs via **`puppeteer-core` + `@sparticuz/chromium`** when `VERCEL=1`. Do **not** wrap the app in `serverless-http` or an `api/` entry — Vercel invokes Express with Node **`req`/`res`** (Lambda-style adapters break routing).

1. **Import project** → select this repo → **Root directory:** empty. After import, open **Project → Settings → Build and Deployment** (not “General”) and set **Framework Preset** to **Express** if it isn’t already. (Vercel often auto-detects it from the `express` dependency.)
2. **Install Command** (same **Build and Deployment** page): use **`npm install --omit=dev`** so Vercel skips the optional **`puppeteer`** devDependency and keeps the install small. (Local development should still run plain **`npm install`** so `puppeteer` is available on Windows/Mac.)
3. **Build Command:** **`npm run build`** (already set in `package.json`).
4. **Output Directory:** leave empty (not a static export).
5. **Environment variables** — same as production (`NODE_ENV`, `JWT_SECRET`, `OPENROUTER_*`, `PUPPETEER_NO_SANDBOX=true`, …). On Vercel, attach **Redis (Upstash)** so these env vars exist (names depend on integration): **`UPSTASH_REDIS_REST_URL`** + **`UPSTASH_REDIS_REST_TOKEN`**, or the Vercel template equivalents **`KV_REST_API_URL`** + **`KV_REST_API_TOKEN`**. Scope them to **Production** (and Preview if needed). Redis stores **users** and **resume sessions** (about 30 minutes TTL); without Redis, deploys fall back to **`/tmp`**, which is wiped on redeploy — accounts disappear. Verify variables under **Settings → Environment Variables** after linking storage. Vercel sets **`VERCEL=1`** automatically.

**Important limitations:**

| Topic | Notes |
|-------|--------|
| **PDF** | Uses serverless Chromium on Vercel. Hobby tier **max duration is often 10s**; PDF generation may need a **Pro** plan or higher `maxDuration`. If it still fails, host on **Render** instead. |
| **`vercel.json`** | **`functions.server.js`** for **maxDuration** / memory where supported. Set **Framework Preset** under **Settings → Build and Deployment** (not in `vercel.json`). No URL rewrites — **`POST /generate-resume`** and **`/svc/*`** hit **`server.js`** directly. Browser APIs use **`/svc/*`** so **`/api`** stays reserved for Vercel’s filesystem. |
| **Data & sessions** | JSON + sessions use **`/tmp`** on Vercel (see [`services/dataRoot.js`](./services/dataRoot.js)). Instances don’t share disk — use **Render** or a **database** for reliability. |

**Render / Linux without dev `puppeteer`:** set **`USE_SERVERLESS_CHROMIUM=true`** so PDFs use `@sparticuz/chromium` + `puppeteer-core`.

### Important: data on free hosts

User accounts and resume history are stored under `data/` **on the server disk**. On many free tiers the filesystem is **ephemeral** — data can be **lost on redeploy or sleep**. For production you’d move storage to a managed database or attached disk; for demos, expect to re-register after resets.

### Puppeteer on Linux

Cloud hosts usually need `PUPPETEER_NO_SANDBOX=true` (already in `.env.example`). If PDF generation fails on a platform, check their docs for Chrome/Chromium support.

## Scripts

| Command | Purpose |
|--------|---------|
| `npm run dev` | Dev server with nodemon |
| `npm start` | Production server |
| `npm run test:resume` | Generate PDF via API (optional `SCRIPT_API_KEY` on server + same in `.env`) |

## API overview

- `POST /generate-resume` — JSON session + ATS (browser flow); `?format=pdf` for direct PDF.
- `POST /svc/auth/signup`, `/svc/auth/login`, `GET /svc/auth/me`
- `GET /svc/history`, profile, subscription — see routes under `routes/`.

Admin (`nayaksaksham41@*` local part or `ADMIN_EMAIL`): `GET /svc/admin/users`, etc.

## License

ISC
