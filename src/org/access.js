// Premium access (manual approval). A user may start a set number of project idea generations for free
// (subscription setting freeIdeaRuns, default 1). After that, idea generation, the detailed proposal PDF and the
// Erasmus+ evaluation need an active access request, which an administrator approves after checking the payment.
// Prices and plans are settings, not code: the administrator edits them in the admin dashboard.
// No payment provider is connected; a provider can later set the same statuses through this module.

import { HttpError, json, randomId } from "./http.js";
import { sendEmail } from "./email.js";

export const STATUSES = ["pending_payment", "payment_submitted", "active", "rejected", "revoked", "expired"];
const OPEN = ["pending_payment", "payment_submitted"];

export const DEFAULT_SUBSCRIPTION = {
  freeIdeaRuns: 1,                // free idea generations per user
  accessDays: null,               // days of access after approval; null = until revoked
  plans: [{ id: "premium", name: "Premium access", price: "", description: "" }],
  paymentInstructions: "",        // shown to users after they ask for access (bank details, reference format)
};

export const isAdmin = (env, user) => !!user && String(env.ADMIN_EMAILS || "").split(",").map((x) => x.trim().toLowerCase()).filter(Boolean).includes(user.email);

const clip = (s, n) => String(s ?? "").replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "").trim().slice(0, n);

export function cleanSubscription(v) {
  const s = v && typeof v === "object" ? v : {};
  const runs = Number.isInteger(s.freeIdeaRuns) && s.freeIdeaRuns >= 0 && s.freeIdeaRuns <= 100 ? s.freeIdeaRuns : DEFAULT_SUBSCRIPTION.freeIdeaRuns;
  const days = Number.isInteger(s.accessDays) && s.accessDays > 0 && s.accessDays <= 3660 ? s.accessDays : null;
  const plans = (Array.isArray(s.plans) ? s.plans : []).slice(0, 10).map((p) => ({
    id: clip(p && p.id, 40).toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "") || "plan",
    name: clip(p && p.name, 80) || "Plan", price: clip(p && p.price, 80), description: clip(p && p.description, 600),
  })).filter((p, i, a) => a.findIndex((q) => q.id === p.id) === i);
  return { freeIdeaRuns: runs, accessDays: days, plans: plans.length ? plans : DEFAULT_SUBSCRIPTION.plans, paymentInstructions: clip(s.paymentInstructions, 2000) };
}

export async function getSubscription(db) {
  const r = await db.prepare("SELECT value FROM app_settings WHERE key = 'subscription'").first();
  let v = null; try { v = r ? JSON.parse(r.value) : null; } catch { v = null; }
  return cleanSubscription(v || DEFAULT_SUBSCRIPTION);
}

const rowOut = (r) => r && ({
  id: r.id, status: r.status, service: r.service, plan: r.plan, paymentRef: r.payment_ref || "", adminNote: r.admin_note || "",
  requestedAt: r.requested_at, updatedAt: r.updated_at, paidAt: r.paid_at, grantedAt: r.granted_at, expiresAt: r.expires_at,
  notified: !!r.notified, notifyError: r.notify_error || null,
});

// The user's access: the newest request decides. An active request past its end date counts as expired.
export async function accessOf(db, userId, now) {
  const r = await db.prepare("SELECT * FROM access_requests WHERE user_id = ? ORDER BY requested_at DESC, rowid DESC LIMIT 1").bind(userId).first();
  const u = await db.prepare("SELECT idea_runs FROM users WHERE id = ?").bind(userId).first();
  const sub = await getSubscription(db);
  let status = r ? r.status : "none";
  if (status === "active" && r.expires_at && r.expires_at <= now) status = "expired";
  const used = u ? u.idea_runs || 0 : 0;
  return { status, active: status === "active", request: rowOut(r), freeIdeaRuns: sub.freeIdeaRuns, ideaRunsUsed: used, freeLeft: Math.max(0, sub.freeIdeaRuns - used) };
}

// Backend gate. feature: "ideas" (free runs count), "proposal", "evaluation" (premium only).
export async function requireAccess(db, user, feature, now) {
  const a = await accessOf(db, user.id, now);
  if (a.active) return a;
  if (feature === "ideas" && a.freeLeft > 0) return a;
  throw new HttpError(402, "premium_required", { feature, status: a.status, freeIdeaRuns: a.freeIdeaRuns });
}
export const countIdeaRun = (db, userId) => db.prepare("UPDATE users SET idea_runs = idea_runs + 1 WHERE id = ?").bind(userId).run();

const TZ = "Europe/Belgrade";
const when = (ms) => `${new Intl.DateTimeFormat("en-GB", { dateStyle: "long", timeStyle: "short", timeZone: TZ }).format(new Date(ms))} (${TZ}), ${new Date(ms).toISOString().slice(0, 16).replace("T", " ")} UTC`;
const SERVICE = { project_ideas: "Project idea generation, detailed proposal PDF and Erasmus+ evaluation" };

// E-mail to every administrator address. The result is stored on the request, so the dashboard shows failures.
export async function notifyAdmins(env, db, reqId, event, fetchImpl) {
  const r = await db.prepare("SELECT a.*, u.email, u.name AS uname, o.name AS oname FROM access_requests a JOIN users u ON u.id = a.user_id LEFT JOIN organizations o ON o.id = a.org_id WHERE a.id = ?").bind(reqId).first();
  if (!r) return { sent: false };
  const to = String(env.ADMIN_NOTIFY_EMAILS || env.ADMIN_EMAILS || "").split(",").map((x) => x.trim()).filter(Boolean);
  const sub = await getSubscription(db);
  const plan = sub.plans.find((p) => p.id === r.plan);
  const site = env.SITE_URL || "https://eligiblecalls.pages.dev";
  const subject = event === "payment" ? `Payment reported: ${r.email}` : `Premium access request: ${r.email}`;
  const text = [
    event === "payment" ? "A user reported a payment for premium access on Eligible Calls." : "A user asked for premium access on Eligible Calls.",
    "",
    `Name: ${r.uname || "(not given by the Google account)"}`,
    `E-mail: ${r.email}`,
    `Organisation: ${r.oname || "(none)"}`,
    `Date and time: ${when(event === "payment" && r.paid_at ? r.paid_at : r.requested_at)}`,
    `Service: ${SERVICE[r.service] || r.service}`,
    `Plan: ${plan ? plan.name + (plan.price ? " (" + plan.price + ")" : "") : r.plan || "-"}`,
    ...(r.payment_ref ? [`Payment reference given by the user: ${r.payment_ref}`] : []),
    `Status: ${r.status}`,
    "",
    `Open in the admin dashboard: ${site}/#org/admin/r/${r.id}`,
  ].join("\n");
  let res = { sent: false, reason: "no_admin_address" };
  if (to.length) {
    res = { sent: true };
    for (const addr of to) {
      const one = await sendEmail(env, { to: addr, subject, text }, fetchImpl).catch((e) => ({ sent: false, reason: "error" }));
      if (!one.sent) res = one;
    }
  }
  await db.prepare("UPDATE access_requests SET notified = ?, notify_error = ? WHERE id = ?").bind(res.sent ? 1 : 0, res.sent ? null : String(res.reason || "failed").slice(0, 80), r.id).run();
  return res;
}

// ---------- user side: /api/access ----------
export async function userAccessRoute({ env, db, user, M, parts, body, now, fetchImpl, waitUntil }) {
  if (!user) throw new HttpError(401, "signin");
  const sub = await getSubscription(db);
  const pub = { plans: sub.plans, paymentInstructions: sub.paymentInstructions, accessDays: sub.accessDays };
  if (M === "GET" && !parts[1]) return json({ ...(await accessOf(db, user.id, now)), settings: pub });
  if (M === "POST" && parts[1] === "request") {
    const a = await accessOf(db, user.id, now);
    if (a.active) return json({ ...a, settings: pub });
    const plan = sub.plans.find((p) => p.id === body.plan) ? body.plan : sub.plans[0].id;
    let orgId = typeof body.orgId === "string" && /^[0-9a-f]{24}$/.test(body.orgId) ? body.orgId : null;
    if (orgId && !(await db.prepare("SELECT 1 FROM org_members WHERE org_id = ? AND user_id = ?").bind(orgId, user.id).first())) orgId = null;
    let id;
    if (a.request && OPEN.includes(a.request.status)) {
      id = a.request.id;   // one open request at a time; asking again updates it
      await db.prepare("UPDATE access_requests SET plan = ?, org_id = COALESCE(?, org_id), updated_at = ? WHERE id = ?").bind(plan, orgId, now, id).run();
    } else {
      id = randomId();
      await db.prepare("INSERT INTO access_requests (id, user_id, org_id, service, plan, status, requested_at, updated_at) VALUES (?, ?, ?, 'project_ideas', ?, 'pending_payment', ?, ?)")
        .bind(id, user.id, orgId, plan, now, now).run();
    }
    await notifyAdmins(env, db, id, "request", fetchImpl);
    return json({ ...(await accessOf(db, user.id, now)), settings: pub }, 201);
  }
  if (M === "POST" && parts[1] === "payment") {
    const a = await accessOf(db, user.id, now);
    if (!a.request || !OPEN.includes(a.request.status)) throw new HttpError(409, "no_open_request");
    const ref = clip(body.reference, 200);
    await db.prepare("UPDATE access_requests SET status = 'payment_submitted', payment_ref = ?, paid_at = ?, updated_at = ? WHERE id = ?").bind(ref || null, now, now, a.request.id).run();
    await notifyAdmins(env, db, a.request.id, "payment", fetchImpl);
    return json({ ...(await accessOf(db, user.id, now)), settings: pub });
  }
  throw new HttpError(404, "not_found");
}

// ---------- administrator: /api/admin/access, /api/admin/users/:id/access, /api/admin/settings ----------
const ACTIONS = {
  approve: "active", reject: "rejected", revoke: "revoked", expire: "expired",
  pending: "pending_payment", paid: "payment_submitted",
};
export async function adminRoute({ env, db, user, M, parts, body, now }) {
  if (!isAdmin(env, user)) throw new HttpError(404, "not_found");
  const sub = await getSubscription(db);
  if (parts[1] === "settings") {
    if (M === "GET") return json({ subscription: sub });
    if (M === "PUT") {
      const v = cleanSubscription(body.subscription);
      await db.prepare("INSERT INTO app_settings (key, value, updated_at, updated_by) VALUES ('subscription', ?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at, updated_by = excluded.updated_by")
        .bind(JSON.stringify(v), now, user.id).run();
      return json({ subscription: v });
    }
  }
  if (parts[1] === "access" && M === "GET" && !parts[2]) {
    const reqs = (await db.prepare("SELECT a.*, a.rowid AS rn, u.email, u.name AS uname, o.name AS oname, d.email AS decider FROM access_requests a JOIN users u ON u.id = a.user_id LEFT JOIN organizations o ON o.id = a.org_id LEFT JOIN users d ON d.id = a.decided_by ORDER BY a.updated_at DESC LIMIT 500").all()).results || [];
    const users = (await db.prepare("SELECT id, email, name, created_at, last_login_at, idea_runs FROM users ORDER BY created_at DESC LIMIT 2000").all()).results || [];
    const latest = new Map();
    for (const r of [...reqs].sort((a, b) => b.requested_at - a.requested_at || b.rn - a.rn)) if (!latest.has(r.user_id)) latest.set(r.user_id, r);
    const st = (r) => (!r ? "none" : r.status === "active" && r.expires_at && r.expires_at <= now ? "expired" : r.status);
    return json({
      settings: sub,
      requests: reqs.map((r) => ({ ...rowOut(r), userId: r.user_id, email: r.email, name: r.uname || "", org: r.oname || "", decidedBy: r.decider || "", current: latest.get(r.user_id) === r, effective: st(r) })),
      users: users.map((u) => { const r = latest.get(u.id); return { id: u.id, email: u.email, name: u.name || "", createdAt: u.created_at, lastLogin: u.last_login_at, ideaRuns: u.idea_runs || 0, status: st(r), requestId: r ? r.id : null, grantedAt: r ? r.granted_at : null, expiresAt: r ? r.expires_at : null }; }),
    });
  }
  // change one request's status
  if (parts[1] === "access" && parts[2] && M === "POST") {
    const r = await db.prepare("SELECT * FROM access_requests WHERE id = ?").bind(parts[2]).first();
    if (!r) throw new HttpError(404, "not_found");
    const to = ACTIONS[body.action];
    if (!to) throw new HttpError(400, "invalid");
    const note = body.note !== undefined ? clip(body.note, 1000) : r.admin_note;
    const days = Number.isInteger(body.days) && body.days > 0 ? body.days : sub.accessDays;
    if (to === "active") {
      await db.prepare("UPDATE access_requests SET status = 'active', granted_at = ?, expires_at = ?, decided_by = ?, admin_note = ?, updated_at = ? WHERE id = ?")
        .bind(now, days ? now + days * 864e5 : null, user.id, note, now, r.id).run();
    } else {
      await db.prepare("UPDATE access_requests SET status = ?, decided_by = ?, admin_note = ?, updated_at = ?, expires_at = CASE WHEN ? IN ('revoked', 'expired') THEN ? ELSE expires_at END WHERE id = ?")
        .bind(to, user.id, note, now, to, now, r.id).run();
    }
    return json({ ok: true, status: to });
  }
  // grant or revoke access for a user directly (a new request row records who did it and when)
  if (parts[1] === "users" && parts[2] && parts[3] === "access" && M === "POST") {
    const u = await db.prepare("SELECT id FROM users WHERE id = ?").bind(parts[2]).first();
    if (!u) throw new HttpError(404, "not_found");
    const to = body.action === "grant" ? "active" : body.action === "revoke" ? "revoked" : null;
    if (!to) throw new HttpError(400, "invalid");
    const days = Number.isInteger(body.days) && body.days > 0 ? body.days : sub.accessDays;
    const plan = sub.plans.find((p) => p.id === body.plan) ? body.plan : sub.plans[0].id;
    const id = randomId();
    await db.prepare("INSERT INTO access_requests (id, user_id, service, plan, status, admin_note, requested_at, updated_at, granted_at, expires_at, decided_by) VALUES (?, ?, 'project_ideas', ?, ?, ?, ?, ?, ?, ?, ?)")
      .bind(id, u.id, plan, to, clip(body.note, 1000) || (to === "active" ? "Granted by an administrator" : "Revoked by an administrator"), now, now, to === "active" ? now : null, to === "active" ? (days ? now + days * 864e5 : null) : now, user.id).run();
    return json({ ok: true, id, status: to });
  }
  throw new HttpError(404, "not_found");
}
