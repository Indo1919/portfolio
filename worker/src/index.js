// Matias's AI: the chat on matiasindacochea.com (a Cloudflare Worker).
// Who Matias is, and how he talks, lives in the site at assets/data/persona.txt: edit it there and push.
// Model: Claude when the ANTHROPIC_API_KEY secret is set, otherwise Workers AI (binding "AI", no key).
// POST /chat {messages:[{role, content}]} streams back: data: {"t":"words"} ... data: [DONE]. GET /health.
// Guards: only the portfolio's origins, JSON under 20 KB, 12 short messages, about 10 a minute per visitor
// (the LIMITER rate-limit binding when present), short answers, the persona can't be changed from outside,
// attempts to pull out its instructions get a polite no, and an answer that starts repeating them is cut off.
// Privacy: it only knows the persona (public work, process, resume); asking for private chats, messages or personal
// details gets a fixed reply that never reaches the model.
// Safety: rude, sexual or hateful messages never reach the persona. A word list catches the obvious ones, then
// Llama Guard (Workers AI) checks the rest; both get a short witty line back. Anyone who sounds in distress gets
// a kind answer and a crisis line instead, never a joke. Flagged messages use up extra rate-limit quota.
// Length: the persona asks for 25 to 55 words; past MAX_WORDS the reply stops at the end of its sentence.
// A question that matches one of the persona's MODEL ANSWERS (every suggestion chip does, and close rewordings by keywords) gets that answer as written.
const PERSONA_URL = "https://matiasindacochea.com/assets/data/persona.txt";
const ORIGINS = "https://matiasindacochea.com,https://www.matiasindacochea.com,https://indo1919.github.io,http://localhost:4321,http://localhost:4330";
const FALLBACK = "You are Matias Indacochea's AI on his portfolio. Your notes failed to load, so say briefly that you can't answer right now and invite the visitor to email matiasindacochea@outlook.com. Never invent anything.";
const MAX_MESSAGES = 12, MAX_CHARS = 1200, MAX_TOTAL = 9000, MAX_BODY = 20000, MAX_TOKENS = 200, MAX_WORDS = 75, NL = String.fromCharCode(10);
const hits = new Map();
let persona = { text: "", at: 0, qa: new Map() };
const TRICK = /(ignore|disregard|forget|override)[^.?!]{0,40}(instruction|rule|prompt|above|previous)|system prompt|your (instructions|prompt)|(reveal|print|repeat)[^.?!]{0,30}(prompt|instructions)|(pretend|act as if|imagine)[^.?!]{0,30}(no rules|no restrictions|unfiltered)|everything you (were|have been|'ve been) told|jailbreak|developer mode/i;
const LEAK = /MY VOICE|HONESTY RULES|WHO I AM|MODEL ANSWERS|STORY BANK|HOW I GROW|You are Matias Indacochea/;
const PRIVATE = /(chat|conversation|message|text|dm)s? (history|logs?)|(private|personal) (chats?|conversations?|messages?|texts?|emails?|notes|life|details|info|information|data)|what (did|does|has) (matias|he) (say|said|tell|told|text|texted|write|wrote|message)|(conversations?|chats?|talks?) (with|between) (matias|him)|(your|the) (training|source) data|(read|show|give|share|leak)[^.?!]{0,20}(his|matias|private) (messages|emails|chats|texts|notes|dms)/i;
const PRIVACY = "I only know my public work, my process and my resume, nothing from private chats, messages or my personal life. For anything else, the real me is at matiasindacochea@outlook.com.";
const NO = "Those are my behind-the-scenes notes, so I'll keep them to myself. Ask me anything about my work, how I work, or me.";
const GUARD = "@cf/meta/llama-guard-3-8b";
const SELF = /(kill|hurt|harm|cut) (myself|me)([^a-z]|$)|suicid|end (my life|it all)|want to die|(^|[^a-z])kms([^a-z]|$)/i;
const RUDE = /(^|[^a-z])(fuck|shit|bitch|cunt|whore|slut|porn|nudes?([^a-z]|$)|horny|sexy|blowjob|dick ?pics?|suck my|asshole|bastard|motherf|nigg|fag|retard|kys([^a-z]|$)|kill yourself|rape([^a-z]|$))/i;
const IGNORE = ["S5", "S6", "S7", "S8", "S13"];
const WITTY = ["I'm going to let that one sail right past me. Ask me about my work instead, I have better stories there.", "Bold opener. I'll pass on that one and stick to what I'm good at: design. What would you like to know?", "I only answer questions I'd be happy to answer in front of a hiring manager. Try me on Halo, or how I work with AI.", "Let's keep this one portfolio-friendly. Ask me why I built Halo, or what I'm looking for next.", "That one's not in my case studies, and it's staying that way. Ask me anything about how I design."];
const CARE = "I'm only an AI on a design portfolio, but I'm glad you said something. Please reach out to someone you trust, or a crisis line: in the US you can call or text 988, any time. You don't have to handle it alone.";

const norm = s => String(s).toLowerCase().replace(/[^a-z ]/g, "").replace(/ +/g, " ").trim();
const STOP = new Set("a an the do does did you your i me my to of in on for and or is are was were be what whats how why when where who which tell about can could would will please with at it this that as designer experience any have has".split(" "));
const keywords = s => norm(s).split(" ").filter(x => x && !STOP.has(x)).map(x => (x.length > 3 ? x.replace(/(ing|ed|s)$/, "") : x));

function answerFor(question) {
  const exact = persona.qa.get(norm(question));
  if (exact) return exact;
  const a = new Set(keywords(question));
  if (!a.size) return "";
  let best = 0, found = "";
  persona.qa.forEach((answer, q) => { const b = new Set(keywords(q)); let both = 0; a.forEach(x => { if (b.has(x)) both++; }); const score = both / (a.size + b.size - both); if (score > best) { best = score; found = answer; } });
  return best >= 0.6 ? found : "";
}

function modelAnswers(text) {
  const qa = new Map(), start = text.indexOf("MODEL ANSWERS");
  if (start < 0) return qa;
  const end = text.indexOf("STORY BANK", start);
  const lines = text.slice(start, end > start ? end : text.length).split(NL);
  for (let i = 0; i < lines.length - 1; i++) {
    if (lines[i].startsWith("Q: ") && lines[i + 1].startsWith("A: ")) lines[i].slice(3).split(" / ").forEach(q => qa.set(norm(q), lines[i + 1].slice(3).trim()));
  }
  return qa;
}

async function loadPersona(env) {
  if (persona.text && Date.now() - persona.at < 300000) return persona.text;
  try {
    const res = await fetch(env.PERSONA_URL || PERSONA_URL, { cf: { cacheTtl: 300, cacheEverything: true } });
    if (res.ok) { const text = (await res.text()).trim(); if (text.length > 200) persona = { text, at: Date.now(), qa: modelAnswers(text) }; }
  } catch (e) {
    persona.at = Date.now() - 240000;
  }
  return persona.text || FALLBACK;
}

function cors(origin, allowed) {
  return { "Access-Control-Allow-Origin": allowed.includes(origin) ? origin : allowed[0], "Access-Control-Allow-Methods": "POST, GET, OPTIONS", "Access-Control-Allow-Headers": "Content-Type", "Access-Control-Max-Age": "86400", "Vary": "Origin", "X-Content-Type-Options": "nosniff", "Referrer-Policy": "no-referrer" };
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

async function limited(env, ip, perMin) {
  if (env.LIMITER) { try { const r = await env.LIMITER.limit({ key: ip }); return !r.success; } catch (e) { return false; } }
  const now = Date.now(), list = (hits.get(ip) || []).filter(t => now - t < 60000);
  list.push(now);
  hits.set(ip, list);
  if (hits.size > 5000) hits.clear();
  return list.length > perMin;
}

function said(text, headers) {
  return new Response("data: " + JSON.stringify({ t: text }) + NL + NL + "data: [DONE]" + NL + NL, { headers: { ...headers, "Content-Type": "text/event-stream", "Cache-Control": "no-store" } });
}

function relay(upstream, pick) {
  const enc = new TextEncoder(), dec = new TextDecoder();
  let buf = "", held = "", all = "", open = false, stopped = false;
  const send = (ctl, t) => ctl.enqueue(enc.encode("data: " + JSON.stringify({ t }) + NL + NL));
  return upstream.pipeThrough(new TransformStream({
    transform(chunk, ctl) {
      buf += dec.decode(chunk, { stream: true });
      const lines = buf.split(NL);
      buf = lines.pop();
      for (const line of lines) {
        if (!line.startsWith("data:")) continue;
        const data = line.slice(5).trim();
        if (!data || data === "[DONE]") continue;
        let t = "";
        try { t = pick(JSON.parse(data)) || ""; } catch (e) { continue; }
        if (!t || stopped) continue;
        all += t;
        if (LEAK.test(all)) { stopped = true; send(ctl, open ? " " + NO : NO); continue; }
        if (!open) { held += t; if (held.length < 60) continue; open = true; t = held; }
        send(ctl, t);
        if (all.split(" ").length > MAX_WORDS && /[.!?]["')]?$/.test(all.trimEnd())) stopped = true;
      }
    },
    flush(ctl) { if (!open && !stopped && held) send(ctl, held); ctl.enqueue(enc.encode("data: [DONE]" + NL + NL)); },
  }));
}

async function guard(env, text) {
  if (!env.AI) return "";
  try {
    const r = await env.AI.run(env.GUARD_MODEL || GUARD, { messages: [{ role: "user", content: text }], max_tokens: 24, temperature: 0 });
    const v = r && r.response;
    const cats = (v && typeof v === "object" ? (v.categories || []).join(" ") : String(v || "")).toUpperCase().match(/S[0-9]+/g) || [];
    const unsafe = v && typeof v === "object" ? v.safe === false : String(v || "").trim().toLowerCase().startsWith("unsafe");
    if (!unsafe) return "";
    if (cats.includes("S11")) return "care";
    return !cats.length || cats.some(c => !IGNORE.includes(c)) ? "rude" : "";
  } catch (e) {
    return "";
  }
}

async function askClaude(env, system, messages) {
  const res = await fetch("https://api.anthropic.com/v1/messages", { method: "POST", headers: { "content-type": "application/json", "x-api-key": env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" }, body: JSON.stringify({ model: env.CLAUDE_MODEL || "claude-haiku-5-5", max_tokens: MAX_TOKENS, system, messages, stream: true }) });
  if (!res.ok || !res.body) throw new Error("claude " + res.status);
  return relay(res.body, d => d.type === "content_block_delta" && d.delta && d.delta.text);
}

async function askWorkersAI(env, system, messages) {
  const stream = await env.AI.run(env.CF_MODEL || "@cf/meta/llama-3.3-70b-instruct-fp8-fast", { messages: [{ role: "system", content: system }, ...messages], stream: true, max_tokens: MAX_TOKENS, temperature: 0.5 });
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
    if (await limited(env, request.headers.get("CF-Connecting-IP") || "unknown", +(env.RATE_PER_MIN || 10))) return json({ error: "slow down" }, 429, headers);
    if (!(request.headers.get("Content-Type") || "").includes("application/json")) return json({ error: "json only" }, 415, headers);
    if (+(request.headers.get("Content-Length") || 0) > MAX_BODY) return json({ error: "too large" }, 413, headers);
    let body = null;
    try { const raw = await request.text(); if (raw.length > MAX_BODY) return json({ error: "too large" }, 413, headers); body = JSON.parse(raw); } catch (e) { return json({ error: "bad json" }, 400, headers); }
    const messages = clean(body && body.messages);
    if (!messages) return json({ error: "bad messages" }, 400, headers);
    const last = messages[messages.length - 1].content, ip = request.headers.get("CF-Connecting-IP") || "unknown";
    if (SELF.test(last)) return said(CARE, headers);
    if (TRICK.test(last)) return said(NO, headers);
    if (PRIVATE.test(last)) return said(PRIVACY, headers);
    const system = await loadPersona(env);
    const canned = answerFor(last);
    if (canned) return said(canned, headers);
    const flag = RUDE.test(last) ? "rude" : await guard(env, last);
    if (flag === "care") return said(CARE, headers);
    if (flag === "rude") { await limited(env, ip, 10); await limited(env, ip, 10); return said(WITTY[Math.floor(Math.random() * WITTY.length)], headers); }
    try {
      const stream = env.ANTHROPIC_API_KEY ? await askClaude(env, system, messages) : await askWorkersAI(env, system, messages);
      return new Response(stream, { headers: { ...headers, "Content-Type": "text/event-stream", "Cache-Control": "no-store" } });
    } catch (e) {
      return json({ error: "model unavailable" }, 502, headers);
    }
  },
};
