# Matias's AI (the chat on the homepage)

A Cloudflare Worker that answers as Matias. Who he is and how he talks is a file in the site,
`assets/data/persona.txt` (facts only from the site, the resume and Matias himself, plus the rules for answering).
The worker reads it on each request (cached five minutes), so editing the voice is a normal push to GitHub.
The homepage's chat (feature "muse" in `assets/js/site.js`) posts the conversation to `/chat` and streams the reply.
Live at `https://matias-ai.matiasindacochea2004.workers.dev` (Cloudflare account of matiasindacochea2004@gmail.com).
This folder is not published with the site.

## Models
- **Workers AI** (default, no key): the `AI` binding runs `@cf/meta/llama-3.3-70b-instruct-fp8-fast` on
  Cloudflare's free daily allowance.
- **Claude** (better writing): add a secret `ANTHROPIC_API_KEY` and it switches to `claude-haiku-5-5`
  (override with a `CLAUDE_MODEL` variable). Set a monthly spend limit in the Anthropic console.

## Deploy from the Cloudflare dashboard (no installs)
1. Workers & Pages → Create → Create Worker → name it `matias-ai` → Deploy.
2. Edit code → replace everything with `src/index.js` → Deploy.
3. Settings → Bindings → Add → Workers AI → variable name `AI`.
4. Settings → Variables and secrets → add `ALLOWED_ORIGINS` =
   `https://matiasindacochea.com,https://www.matiasindacochea.com,http://localhost:4321,http://localhost:4330`
   (and optionally `RATE_PER_MIN` = `10`, or the secret `ANTHROPIC_API_KEY`).
5. Copy the worker URL (`https://matias-ai.<subdomain>.workers.dev`) and set
   `data-endpoint="https://matias-ai.<subdomain>.workers.dev/chat"` on `[data-muse]` in `index.html`.
6. Check: `https://matias-ai.<subdomain>.workers.dev/health` shows `{"ok":true,...}`.

Or with Wrangler: `npm i -g wrangler && wrangler login && wrangler deploy` from this folder (uses `wrangler.toml`).

## What it enforces
Only the portfolio's origins; at most 12 messages of 1,200 characters; about 10 requests a minute per
visitor; the persona can't be replaced from the browser; the worker never logs conversations.

## Changing what it knows or how it sounds
Edit `assets/data/persona.txt` and push; the worker picks it up within five minutes. Keep it to facts that are
on the site, the resume or Matias's own notes. If a project or the resume changes, update it too.
Changing the worker code itself means pasting `src/index.js` into the dashboard editor again (or `wrangler deploy`).
