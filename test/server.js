// Local preview: serves site/ like Cloudflare Pages (including _headers) and routes /api/* to the
// same handlers the Pages Functions use, with test doubles for D1, Workers AI and Groq.
//   node test/server.js            -> http://localhost:8788
// Env: PORT, DATA_DIR (serve /data/* from another folder), AI_MODE (ok | quota | off), GROQ (1 = fake Groq key),
//      NOW (ISO time the API should treat as now), RESTING (1 = budgets spent)
import http from "node:http";
import { readFileSync, existsSync, statSync } from "node:fs";
import path from "node:path";
import { handleChat, handleHealth } from "../src/chat.js";
import { handleApi } from "../src/org/api.js";
import { mockD1, mockAI, mockFetch, sseStream, ROOT } from "./mocks.js";

const SITE = path.join(ROOT, "site");
const DATA = process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : path.join(SITE, "data");
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".json": "application/json", ".md": "text/markdown; charset=utf-8", ".css": "text/css" };

// _headers: path patterns with "/*" suffix or exact paths
const rules = [];
{
  let cur = null;
  for (const line of readFileSync(path.join(SITE, "_headers"), "utf8").split("\n")) {
    if (!line.trim()) continue;
    if (!/^\s/.test(line)) { cur = { pat: line.trim(), h: [] }; rules.push(cur); }
    else { const i = line.indexOf(":"); cur.h.push([line.slice(0, i).trim(), line.slice(i + 1).trim()]); }
  }
}
const headersFor = (p) => rules.filter((r) => (r.pat.endsWith("/*") ? p.startsWith(r.pat.slice(0, -1)) : p === r.pat)).flatMap((r) => r.h);

// A test model that answers in the shape the real prompt asks for, using the candidate calls it was given.
function demoAI(seen) {
  return { run: async (model, input) => {
    seen.push(input);
    const sys = input.messages[0].content;
    if (sys.startsWith("You extract facts about one organisation")) {
      // Organisation extraction: propose the first line as the name and the first long sentence as the description, quoted.
      const src = (input.messages[1].content.match(/<source>\n([\s\S]*)\n<\/source>/) || [, ""])[1];
      const lines = src.split("\n").map((l) => l.replace(/^### PAGE \S+/, "").trim()).filter((l) => l.length > 3);
      const sentence = (src.match(/[^.\n]{60,400}\./) || [""])[0].trim();
      const fields = {};
      if (lines[0] && lines[0].length < 120) fields.name = { value: lines[0], evidence: lines[0], confidence: "medium" };
      if (sentence) fields.description = { value: sentence, evidence: sentence, confidence: "medium" };
      fields.employees = { value: 12, evidence: "The organisation employs 12 people.", confidence: "high" }; // a quote that is not in the source
      return sseStream([{ response: JSON.stringify({ fields }) }, { response: "", usage: { prompt_tokens: 3000, completion_tokens: 300 } }]);
    }
    const blocks = [...sys.matchAll(/^### (\S+)\nTitle: (.*)\n.*\nNext deadline: (\S+)/gm)].slice(0, 3);
    const country = (sys.match(/APPLICANT: country (\w\w)/) || [])[1];
    const text = blocks.length
      ? `### Shortlist\n${blocks.map((b, i) => `${i + 1}. **${b[1]}** – ${b[2]}. Next deadline ${b[3]} at 17:00 Brussels time.`).join("\n")}\n\n### Next steps\n- Read the conditions on the official page of ${blocks[0][1]}.\n- ${country ? "Eligibility shown for " + country + "." : "Tell me your country so I can check eligibility."}\n\n(Test model: local preview, not a real answer.)`
      : "No open call matched. (Test model)";
    const parts = text.match(/.{1,24}/gs);
    return sseStream([...parts.map((p) => ({ response: p })), { response: "", usage: { prompt_tokens: 4200, completion_tokens: 350 } }]);
  } };
}

const db = mockD1();
if (process.env.RESTING === "1") db._db.exec(`INSERT INTO usage VALUES ('${new Date().toISOString().slice(0, 10)}','workers-ai',9000,0,40)`);
const seen = [];
const env = {
  DB: db,
  ASSETS: { fetch: async (u) => { const p = new URL(u).pathname; const f = p.startsWith("/data/") ? path.join(DATA, p.slice(6)) : path.join(SITE, p); return existsSync(f) ? new Response(readFileSync(f)) : new Response("nf", { status: 404 }); } },
  ...(process.env.AI_MODE === "off" ? {} : { AI: process.env.AI_MODE === "quota" ? mockAI("quota") : demoAI(seen) }),
  ...(process.env.GROQ === "1" ? { GROQ_API_KEY: "test" } : {}),
  DAILY_VISITOR_LIMIT: process.env.VISITOR_LIMIT || "50",
  DEV_LOGIN_LINKS: "1", ADMIN_EMAILS: process.env.ADMIN_EMAILS || "",
  ...(process.env.EMAIL_LOGIN === "1" ? { EMAIL_LOGIN: "1" } : {}),
  // Google sign-in against a stand-in token endpoint: the browser test answers Google's page itself and
  // passes {email, nonce} as the code (base64url JSON).
  GOOGLE_CLIENT_ID: "local-test.apps.googleusercontent.com", GOOGLE_CLIENT_SECRET: "local",
};
const googleStub = async (url, init) => {
  if (String(url) === "https://oauth2.googleapis.com/token") {
    const code = new URLSearchParams(init.body).get("code");
    const c = JSON.parse(Buffer.from(code, "base64url").toString());
    const claims = { iss: "https://accounts.google.com", aud: env.GOOGLE_CLIENT_ID, exp: Math.floor(Date.now() / 1000) + 3600, sub: "local-" + c.email, email: c.email, email_verified: true, nonce: c.nonce };
    return new Response(JSON.stringify({ id_token: "x." + Buffer.from(JSON.stringify(claims)).toString("base64url") + ".x" }), { headers: { "content-type": "application/json" } });
  }
  return fetch(url, init);
};
const nowFn = () => (process.env.NOW ? Date.parse(process.env.NOW) : Date.now());

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://" + (req.headers.host || "localhost"));
  try {
    if (url.pathname.startsWith("/api/")) {
      const chunks = []; for await (const c of req) chunks.push(c);
      const request = new Request(url, { method: req.method, headers: { ...req.headers, "cf-connecting-ip": req.socket.remoteAddress }, body: ["POST", "PUT", "PATCH", "DELETE"].includes(req.method) && chunks.length ? Buffer.concat(chunks) : undefined });
      let r;
      if (url.pathname === "/api/chat" && req.method === "POST") r = await handleChat({ request, env, now: nowFn(), fetchImpl: mockFetch() });
      else if (url.pathname === "/api/health") r = await handleHealth({ env, now: nowFn() });
      else if (/^\/api\/(auth|orgs|admin)(\/|$)|^\/api\/me$/.test(url.pathname)) r = await handleApi({ request, env, now: nowFn(), fetchImpl: googleStub });
      else r = new Response("not found", { status: 404 });
      const hs = Object.fromEntries([...r.headers].filter(([k]) => k !== "set-cookie"));
      const sc = r.headers.getSetCookie(); if (sc.length) hs["set-cookie"] = sc;
      res.writeHead(r.status, hs);
      if (r.body) for await (const c of r.body) res.write(c);
      return res.end();
    }
    let p = url.pathname === "/" ? "/index.html" : url.pathname;
    const file = p.startsWith("/data/") ? path.join(DATA, p.slice(6)) : path.join(SITE, path.normalize(p));
    if (!file.startsWith(SITE) && !file.startsWith(DATA)) { res.writeHead(403); return res.end(); }
    if (!existsSync(file) || statSync(file).isDirectory()) { res.writeHead(404); return res.end("not found"); }
    res.writeHead(200, { "content-type": TYPES[path.extname(file)] || "application/octet-stream", ...Object.fromEntries(headersFor(p)) });
    res.end(readFileSync(file));
  } catch (e) { console.error(e); res.writeHead(500); res.end(String(e)); }
});
const port = +(process.env.PORT || 8788);
server.listen(port, () => console.log(`Eligible Calls preview on http://localhost:${port}`));
export { seen };
