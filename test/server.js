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
    if (sys.startsWith("You are the project ideation agent")) {
      // Project ideas: one idea for each of the first three listed calls, plus one for a call that was not listed
      // (the server must drop it).
      const ids = ((sys.match(/copied from this list: ([^\n]*?)\. Never/) || [])[1] || "").split(", ").filter(Boolean);
      const idea = (callId, i) => ({ callId, title: `Test idea ${i + 1} for ${callId}`, concept: "A concept written by the test model.", problem: "A problem.", solution: "A solution.",
        objectives: ["Train 40 youth workers by month 12", "Reach 300 young people in 6 towns"], targetGroups: ["Young people"], activities: ["Workshops", "Online course"],
        expectedResults: ["40 trained youth workers"], potentialPartners: ["A school in another country"], whyItFits: "The profile shows matching experience.",
        fit: { alignment: 4 - i, priorities: 4, feasibility: 3, impact: 4, reasons: "Test ratings.",
          // idea 2 gets a generic explanation, which the server must drop; the others name the concept's own words
          explanation: i === 1 ? { summary: "This is a good project that fits the call well.", strengths: ["Good fit"], weaknesses: ["Could be better"], improve: ["Improve it"] }
            : { summary: `Training 40 youth workers through workshops matches the call's focus on youth work quality (test ${i + 1}).`, strengths: ["The objective to train 40 youth workers matches the call's capacity building priority"],
              weaknesses: ["The online course has no measurable reach target"], improve: ["Add a partner that has run workshops for young people in rural towns"] } } });
      const ideas = ids.slice(0, 3).map(idea).concat([idea("INVENTED-CALL-ID", 3)]);
      return sseStream([{ response: JSON.stringify({ ideas }) }, { response: "", usage: { prompt_tokens: 3500, completion_tokens: 900 } }]);
    }
    if (sys.startsWith("You turn one project idea into a detailed project proposal")) {
      const idea = JSON.parse((input.messages[1].content.match(/<idea>\n([\s\S]*?)\n<\/idea>/) || [, "{}"])[1]);
      const p = { title: (idea.title || "Test") + " (proposal)", durationMonths: 18,
        summary: "A test proposal written by the local test model. Ćirilica: Удружење грађана „Млади“ из Новог Сада, latinica: Udruženje građana „Mladi“.",
        problem: "Young people in 6 towns lack youth work services (to be confirmed).", mainObjectives: ["Improve the quality of youth work in 6 towns"],
        specificObjectives: ["Train 40 youth workers by month 12", "Reach 300 young people by month 18"],
        targetGroups: [{ group: "Youth workers", description: "Staff and volunteers", reach: "40" }, { group: "Young people", description: "Aged 15-24", reach: "300" }],
        workPackages: [{ id: "WP1", title: "Management", lead: "Applicant", months: "M1-M18", activities: ["Kick-off meeting"], deliverables: ["Project plan"] },
          { id: "WP2", title: "Training", lead: "Partner (university)", months: "M3-M12", activities: ["Five training days"], deliverables: ["Training curriculum"] }],
        methodology: "Peer learning and blended training.", outputs: [{ output: "Curriculum", indicator: "Modules", target: "6" }, { output: "Trained workers", indicator: "People", target: "40" }],
        impact: "Better services for young people.", partnership: { structure: "Applicant plus two partners.", partners: [{ profile: "University youth studies department", country: "HR", role: "Training design" }] },
        timeline: [{ phase: "Preparation", period: "M1-M3", milestones: ["Partners agree the plan"] }], monitoring: "Quarterly reviews.", sustainability: "Curriculum stays online.",
        risks: [{ risk: "Low participation", likelihood: "medium", mitigation: "Outreach through schools" }], alignment: "Matches the call's youth priority.",
        budget: { requestedTotal: 999999999, basis: "Lump sum", categories: [{ category: "Staff", share: 3, note: "" }, { category: "Travel", share: 1, note: "" }], considerations: "Check the call's lump sums." } };
      return sseStream([{ response: JSON.stringify(p) }, { response: "", usage: { prompt_tokens: 3000, completion_tokens: 1500 } }]);
    }
    if (sys.startsWith("You check whether one organisation meets the mandatory eligibility conditions")) {
      // Official check: quote the first two sentences of the official text (one passes on country, one on a consortium
      // and claims "fail", which the server must turn into unknown) plus one invented quote the server must drop.
      const off = (sys.match(/<official>\n([\s\S]*?)\n<\/official>/) || [, ""])[1];
      const sents = (off.match(/[^.\n]{30,300}\./g) || []).map((x) => x.trim());
      const conditions = [];
      if (sents[0]) conditions.push({ condition: "Applicants must be legal entities established in an eligible country.", quote: sents[0], appliesTo: "applicant", result: "pass", field: "country", reason: "The profile gives the country." });
      if (sents[1]) conditions.push({ condition: "The consortium must have enough partners.", quote: sents[1], appliesTo: "consortium", result: "fail", field: "country", reason: "No partners are listed." });
      conditions.push({ condition: "Invented condition.", quote: "Applicants must have won a Nobel prize in the last five years.", appliesTo: "applicant", result: "fail", field: "orgType", reason: "Invented." });
      return sseStream([{ response: JSON.stringify({ conditions, summary: "Test summary of the official check." }) }, { response: "", usage: { prompt_tokens: 3000, completion_tokens: 500 } }]);
    }
    if (sys.startsWith("You explain why a project concept")) {
      const idea = JSON.parse((input.messages[1].content.match(/<idea>\n([\s\S]*?)\n<\/idea>/) || [, "{}"])[1]);
      const o = (idea.objectives || [])[0] || "", a = (idea.activities || [])[0] || "";
      const ex = { summary: `${idea.title}: the objective "${o}" and the activity "${a}" match the call text.`, strengths: [`${o} answers the call's priority on skills`],
        weaknesses: [`${a} has no measurable target`], improve: ["Name a partner with experience in the target group"] };
      return sseStream([{ response: JSON.stringify(ex) }, { response: "", usage: { prompt_tokens: 2000, completion_tokens: 300 } }]);
    }
    if (sys.startsWith("You are an experienced evaluator")) {
      // Scores at about 70% of each criterion's maximum; with only the funder's text, quote its first lines as criteria.
      const ids = [...sys.matchAll(/^### (c\d+): .*\(score 0 to (\d+(?:\.\d+)?)/gm)].map((m) => [m[1], +m[2]]);
      const why = { justification: "Test justification.", strengths: ["Clear target group"], weaknesses: ["Partners not named"], missing: ["Budget detail"], recommendations: ["Name the partners"] };
      const doc = (sys.match(/<documentation>\n([\s\S]*?)\n<\/documentation>/) || [, ""])[1];
      const criteria = ids.length ? ids.map(([id, max], i) => ({ id, score: Math.round(max * [0.7, 0.6, 0.8, 0.5][i % 4] * 2) / 2, ...why }))
        : doc.split("\n").filter((l) => l.length > 25).slice(0, 2).map((l, i) => ({ name: "Criterion " + (i + 1), quote: l.slice(0, 60), score: 3 + i, ...why }));
      return sseStream([{ response: JSON.stringify({ criteria, summary: "Test evaluation summary.", priorityActions: ["Confirm partners"] }) }, { response: "", usage: { prompt_tokens: 2500, completion_tokens: 900 } }]);
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
      else if (/^\/api\/(auth|orgs|admin|access)(\/|$)|^\/api\/me$/.test(url.pathname)) r = await handleApi({ request, env, now: nowFn(), fetchImpl: googleStub });
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
