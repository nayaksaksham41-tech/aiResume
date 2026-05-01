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

## Free deployment (example: Render)

Good fit for this stack: **Render** (free web service), **Railway**, **Fly.io** — all offer a free tier with limits (sleeps when idle, CPU/time caps).

### Render (recommended starting point)

1. Push the repo to GitHub (above).
2. In [Render Dashboard](https://dashboard.render.com): **New → Web Service**, connect the repo.
3. Settings:
   - **Build command:** `npm install`
   - **Start command:** `npm start`
   - **Instance type:** Free
4. **Environment** (paste from your local `.env`, but never commit them):
   - `NODE_ENV` = `production`
   - `JWT_SECRET` = long random string
   - `PUPPETEER_NO_SANDBOX` = `true`
   - Your AI keys (`OPENROUTER_API_KEY`, etc.)
   - `OPENROUTER_HTTP_REFERER` = `https://<your-service>.onrender.com`
5. Deploy. First PDF build may be slow while Puppeteer downloads Chromium.

Optional: this repo includes [`render.yaml`](./render.yaml) as a blueprint hint; you can still set env vars in the Render UI.

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
- `POST /api/auth/signup`, `/api/auth/login`, `GET /api/auth/me`
- `GET /api/history`, profile, subscription — see routes under `routes/`.

Admin (`nayaksaksham41@*` local part or `ADMIN_EMAIL`): `GET /api/admin/users`, etc.

## License

ISC
