// Test doubles for the Cloudflare bindings: D1 (on node:sqlite), ASSETS, Workers AI and Groq.
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export function mockD1() {
  const db = new DatabaseSync(":memory:");
  db.exec(readFileSync(path.join(ROOT, "schema.sql"), "utf8"));
  const stmt = (sql, args = []) => ({
    bind: (...a) => stmt(sql, a),
    all: async () => ({ results: db.prepare(sql).all(...args) }),
    first: async () => db.prepare(sql).get(...args) || null,
    run: async () => { db.prepare(sql).run(...args); return { success: true }; },
  });
  return { prepare: (sql) => stmt(sql), _db: db };
}

export function mockAssets() {
  return { fetch: async (u) => {
    const p = new URL(u).pathname;
    try { return new Response(readFileSync(path.join(ROOT, "site", p))); } catch { return new Response("nf", { status: 404 }); }
  } };
}

export function sseStream(chunks) {
  const enc = new TextEncoder();
  return new ReadableStream({ start(c) { for (const x of chunks) c.enqueue(enc.encode("data: " + JSON.stringify(x) + "\n\n")); c.enqueue(enc.encode("data: [DONE]\n\n")); c.close(); } });
}

// Workers AI double. mode: "ok" | "quota" | "openai" (OpenAI-format chunks)
export function mockAI(mode = "ok", seen = []) {
  return { run: async (model, input) => {
    seen.push({ model, input });
    if (mode === "quota") throw new Error("4006: you have used up your daily free allocation of 10,000 neurons");
    const sys = input.messages[0].content;
    const ids = [...sys.matchAll(/^### (\S+)/gm)].map((m) => m[1]).slice(0, 2);
    const text = `Shortlist: ${ids.join(", ")}`;
    if (mode === "openai") return sseStream([{ choices: [{ delta: { content: text.slice(0, 10) } }] }, { choices: [{ delta: { content: text.slice(10) } }] }, { choices: [], usage: { prompt_tokens: 4000, completion_tokens: 300 } }]);
    return sseStream([{ response: text.slice(0, 10) }, { response: text.slice(10) }, { response: "", usage: { prompt_tokens: 4000, completion_tokens: 300 } }]);
  } };
}

export function mockFetch(log = [], { groqStatus = 200, turnstileOk = true } = {}) {
  return async (url, init) => {
    log.push({ url, init });
    if (String(url).includes("turnstile")) return new Response(JSON.stringify({ success: turnstileOk }));
    if (String(url).includes("groq.com")) {
      if (groqStatus !== 200) return new Response('{"error":{"message":"rate limit"}}', { status: groqStatus });
      return new Response(sseStream([{ choices: [{ delta: { content: "From Groq." } }] }, { choices: [{ delta: {} }], x_groq: { usage: { prompt_tokens: 3000, completion_tokens: 200 } } }]), { headers: { "content-type": "text/event-stream" } });
    }
    return new Response("unexpected " + url, { status: 500 });
  };
}

export async function readSSE(res) {
  const txt = await res.text();
  return txt.split("\n\n").filter((l) => l.startsWith("data: ")).map((l) => JSON.parse(l.slice(6)));
}
