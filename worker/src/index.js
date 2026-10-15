// Matias's AI: the chat on matiasindacochea.com (a Cloudflare Worker).
// Who Matias is, and how he talks, lives in the site at assets/data/persona.txt: edit it there and push.
// Model: Claude when the ANTHROPIC_API_KEY secret is set, otherwise Workers AI (binding "AI", no key).
// POST /chat {messages:[{role, content}]} streams back: data: {"t":"words"} ... data: [DONE]. GET /health.
const PERSONA_URL = "https://matiasindacochea.com/assets/data/persona.txt";
const ORIGINS = "https://matiasindacochea.com,https://www.matiasindacochea.com,https://indo1919.github.io,http://localhost:4321,http://localhost:4330";
const FALLBACK = "You are Matias Indacochea's AI on his portfolio. Your notes failed to load, so say briefly that you can't answer right now and invite the visitor to email matiasindacochea@outlook.com. Never invent anything.";
const MAX_MESSAGES = 12, MAX_CHARS = 1200, MAX_TOTAL = 9000, NL = String.fromCharCode(10);
const hits = new Map();
let persona = { text: "", at: 0 };

async function loadPersona(env) {
  if (persona.text && Date.now() - persona.at < 300000) return persona.text;
  try {
    const res = await fetch(env.PERSONA_URL || PERSONA_URL, { cf: { cacheTtl: 300, cacheEverything: true } });
    if (res.ok) { const text = (await res.text()).trim(); if (text.length > 200) persona = { text, at: Date.now() }; }
  } catch (e) {
    persona.at = Date.now() - 240000;
  }
  return persona.text || FALLBACK;
}

function cors(origin, allowed) {
  return { "Access-Control-Allow-Origin": allowed.includes(origin) ? origin : allowed[0], "Access-Control-Allow-Methods": "POST, GET, OPTIONS", "Access-Control-Allow-Headers": "Content-Type", "Access-Control-Max-Age": "86400", "Vary": "Origin" };
}

function json(body, status, headers) {
  return new Response(JSON.stringify(body), { status, headers: { ...headers, "Content-Type": "application/json" } });
}

function clean(messages) {
  if (!Array.isArray(messages)) return null;
  const out = messages.slice(-MAX_MESSAGES).filter(m => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string" && m.content.trim()).map(m => ({ role: m.role, content: m.content.slice(0, MAX_CHARS) }));
  while (out.length && out[0].role !== "user") out.shift();
  if (!out.length || out[out.length - 1].role !== "user") return null;
  let total = 0;
  for (let i = out.length - 1; i >= 0; i--) { total += out[i].content.length; if (total > MAX_TOTAL) return out.slice(i + 1); }
  return out;
}

function limited(ip, perMin) {
  const now = Date.now(), list = (hits.get(ip) || []).filter(t => now - t < 60000);
  list.push(now);
  hits.set(ip, list);
  if (hits.size > 5000) hits.clear();
  return list.length > perMin;
}

function relay(upstream, pick) {
  const enc = new TextEncoder(), dec = new TextDecoder();
  let buf = "";
  return upstream.pipeThrough(new TransformStream({
    transform(chunk, ctl) {
      buf += dec.decode(chunk, { stream: true });
      const lines = buf.split(NL);
      buf = lines.pop();
      for (const line of lines) {
        if (!line.startsWith("data:")) continue;
        const data = line.slice(5).trim();
        if (!data || data === "[DONE]") continue;
        try { const t = pick(JSON.parse(data)); if (t) ctl.enqueue(enc.encode("data: " + JSON.stringify({ t }) + NL + NL)); } catch (e) { continue; }
      }
    },
    flush(ctl) { ctl.enqueue(enc.encode("data: [DONE]" + NL + NL)); },
  }));
}

async function askClaude(env, system, messages) {
  const res = await fetch("https://api.anthropic.com/v1/messages", { method: "POST", headers: { "content-type": "application/json", "x-api-key": env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" }, body: JSON.stringify({ model: env.CLAUDE_MODEL || "claude-haiku-5-5", max_tokens: 500, system, messages, stream: true }) });
  if (!res.ok || !res.body) throw new Error("claude " + res.status);
  return relay(res.body, d => d.type === "content_block_delta" && d.delta && d.delta.text);
}

async function askWorkersAI(env, system, messages) {
  const stream = await env.AI.run(env.CF_MODEL || "@cf/meta/llama-3.3-70b-instruct-fp8-fast", { messages: [{ role: "system", content: system }, ...messages], stream: true, max_tokens: 500 });
  return relay(stream, d => d.response);
}

export default {
  async fetch(request, env) {
    const allowed = String(env.ALLOWED_ORIGINS || ORIGINS).split(",").map(s => s.trim()).filter(Boolean);
    const origin = request.headers.get("Origin") || "";
    const headers = cors(origin, allowed);
    const url = new URL(request.url);
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers });
    const model = env.ANTHROPIC_API_KEY ? (env.CLAUDE_MODEL || "claude-haiku-5-5") : (env.AI ? (env.CF_MODEL || "workers-ai") : "");
    if (url.pathname === "/health") return json({ ok: !!model, model, persona: (await loadPersona(env)).length }, 200, headers);
    if (url.pathname !== "/chat" || request.method !== "POST") return json({ error: "not found" }, 404, headers);
    if (!allowed.includes(origin)) return json({ error: "origin not allowed" }, 403, headers);
    if (!model) return json({ error: "no model configured" }, 503, headers);
    if (limited(request.headers.get("CF-Connecting-IP") || "unknown", +(env.RATE_PER_MIN || 10))) return json({ error: "slow down" }, 429, headers);
    let body = null;
    try { body = await request.json(); } catch (e) { return json({ error: "bad json" }, 400, headers); }
    const messages = clean(body && body.messages);
    if (!messages) return json({ error: "bad messages" }, 400, headers);
    try {
      const system = await loadPersona(env);
      const stream = env.ANTHROPIC_API_KEY ? await askClaude(env, system, messages) : await askWorkersAI(env, system, messages);
      return new Response(stream, { headers: { ...headers, "Content-Type": "text/event-stream", "Cache-Control": "no-store" } });
    } catch (e) {
      return json({ error: "model unavailable" }, 502, headers);
    }
  },
};
