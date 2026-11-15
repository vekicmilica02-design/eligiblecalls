// Saved reports: snapshots of one call's eligibility assessment for an organisation, kept so that the team can
// return to them, compare them with the current assessment, add a note and export them as PDF.
// The assessment itself is computed in the browser (site/org/rules.js, deterministic); the server stores the
// snapshot the organisation's editor saved, together with the profile version and the call data date.

import { HttpError, json, randomId } from "./http.js";

export const MAX_REPORTS = 200;     // per organisation
const MAX_DATA = 60000;             // characters of JSON per report
const STATUSES = ["eligible", "potential", "insufficient", "ineligible"];   // STATUS_ORDER in site/org/rules.js
const RESULTS = ["pass", "fail", "warn", "unknown", "missing"];

const clip = (s, n) => String(s ?? "").replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "").trim().slice(0, n);
const arr = (v, n) => (Array.isArray(v) ? v.slice(0, n) : []);
// Codes and parameters are rendered by the page's text tables; keep them small and plain.
const params = (p) => {
  const out = {};
  if (!p || typeof p !== "object") return out;
  for (const [k, v] of Object.entries(p).slice(0, 20)) {
    const key = clip(k, 40);
    if (typeof v === "number" || typeof v === "boolean") out[key] = v;
    else if (Array.isArray(v)) out[key] = v.slice(0, 40).map((x) => (typeof x === "number" ? x : clip(x, 200)));
    else if (v !== null && v !== undefined) out[key] = clip(v, 1500);
  }
  return out;
};
const item = (x) => (x && typeof x === "object" && x.code ? {
  code: clip(x.code, 80), params: params(x.params),
  ...(x.result ? { result: RESULTS.includes(x.result) ? x.result : "unknown" } : {}),
  ...(x.source ? { source: clip(x.source, 40) } : {}),
} : null);

export function cleanReport(b) {
  const c = (b && b.call) || {}, a = (b && b.assessment) || {};
  const score = Math.round(+a.score);
  if (!clip(c.key, 200) || !clip(c.title, 400) || !Number.isFinite(score) || !STATUSES.includes(a.status)) throw new HttpError(400, "invalid");
  const dims = {}, weights = {};
  for (const [k, v] of Object.entries(a.dims || {}).slice(0, 12)) if (Number.isFinite(+v)) dims[clip(k, 30)] = Math.max(0, Math.min(1, +v));
  for (const [k, v] of Object.entries(a.weights || {}).slice(0, 12)) if (Number.isFinite(+v)) weights[clip(k, 30)] = +v;
  const data = {
    call: {
      key: clip(c.key, 200), id: clip(c.id, 200), title: clip(c.title, 400), programme: clip(c.programme, 40), programmeName: clip(c.programmeName, 200),
      url: /^https:\/\//.test(c.url || "") ? clip(c.url, 600) : "", deadline: clip(c.deadline, 40), funding: clip(c.funding, 200),
    },
    assessment: {
      score: Math.max(0, Math.min(100, score)), band: clip(a.band, 20), status: a.status, capApplied: !!a.capApplied,
      checks: arr(a.checks, 80).map(item).filter(Boolean), strengths: arr(a.strengths, 40).map(item).filter(Boolean),
      gaps: arr(a.gaps, 40).map(item).filter(Boolean), next: arr(a.next, 30).map(item).filter(Boolean),
      missing: arr(a.missing, 80).map((x) => clip(x, 60)).filter(Boolean), dims, weights,
    },
    dataGenerated: clip(b.dataGenerated, 40),
  };
  const text = JSON.stringify(data);
  if (text.length > MAX_DATA) throw new HttpError(413, "too_large");
  return { data, text };
}

const rowOut = (r, withData) => ({
  id: r.id, callKey: r.call_key, callTitle: r.call_title, programme: r.programme || "", deadline: r.deadline || "",
  score: r.score, status: r.status, profileVersion: r.profile_version, dataGenerated: r.data_generated || "", note: r.note || "",
  createdAt: r.created_at, updatedAt: r.updated_at, createdBy: r.email || "",
  ...(withData ? { data: JSON.parse(r.data) } : {}),
});

// /api/orgs/:id/reports[/:rid]. requireRole and currentVersion come from the caller (api.js).
export async function reportsRoute({ db, user, M, parts, body, now, orgId, requireRole, currentVersion }) {
  const rid = parts[3];
  if (M === "GET" && !rid) {
    await requireRole(db, orgId, user, "viewer");
    const rows = (await db.prepare("SELECT r.id, r.call_key, r.call_title, r.programme, r.deadline, r.score, r.status, r.profile_version, r.data_generated, r.note, r.created_at, r.updated_at, u.email FROM reports r LEFT JOIN users u ON u.id = r.created_by WHERE r.org_id = ? ORDER BY r.created_at DESC LIMIT ?").bind(orgId, MAX_REPORTS).all()).results || [];
    return json({ reports: rows.map((r) => rowOut(r, false)) });
  }
  if (M === "GET" && rid) {
    await requireRole(db, orgId, user, "viewer");
    const r = await db.prepare("SELECT r.*, u.email FROM reports r LEFT JOIN users u ON u.id = r.created_by WHERE r.id = ? AND r.org_id = ?").bind(rid, orgId).first();
    if (!r) throw new HttpError(404, "not_found");
    return json({ report: rowOut(r, true) });
  }
  if (M === "POST" && !rid) {
    const m = await requireRole(db, orgId, user, "editor");
    const n = await db.prepare("SELECT COUNT(*) AS n FROM reports WHERE org_id = ?").bind(orgId).first();
    if (n && n.n >= MAX_REPORTS) throw new HttpError(409, "too_many_reports");
    const { data, text } = cleanReport(body);
    const id = randomId(), version = await currentVersion(m);
    await db.prepare("INSERT INTO reports (id, org_id, call_key, call_title, programme, deadline, score, status, profile_version, data_generated, data, note, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
      .bind(id, orgId, data.call.key, data.call.title, data.call.programme || null, data.call.deadline || null, data.assessment.score, data.assessment.status, version, data.dataGenerated || null, text, clip(body.note, 1000) || null, user.id, now, now).run();
    const r = await db.prepare("SELECT r.*, u.email FROM reports r LEFT JOIN users u ON u.id = r.created_by WHERE r.id = ?").bind(id).first();
    return json({ report: rowOut(r, true) }, 201);
  }
  if (M === "PATCH" && rid) {
    await requireRole(db, orgId, user, "editor");
    const res = await db.prepare("UPDATE reports SET note = ?, updated_at = ? WHERE id = ? AND org_id = ?").bind(clip(body.note, 1000) || null, now, rid, orgId).run();
    if (!res.meta || !res.meta.changes) throw new HttpError(404, "not_found");
    return json({ ok: true });
  }
  if (M === "DELETE" && rid) {
    await requireRole(db, orgId, user, "editor");
    await db.prepare("DELETE FROM reports WHERE id = ? AND org_id = ?").bind(rid, orgId).run();
    return json({ ok: true });
  }
  throw new HttpError(404, "not_found");
}
