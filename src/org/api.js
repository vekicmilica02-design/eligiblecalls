// Organization Intelligence API. One router for /api/auth/*, /api/me, /api/orgs/*, /api/admin/*.
// Every organisation route checks membership and role first; another organisation's data is never read.

import { json, fail, HttpError, readJson, checkCsrf, randomId, taxonomy } from "./http.js";
import { requestLink, verifyLink, currentUser, logout, cleanEmail, googleStart, googleCallback } from "./auth.js";
import { sendEmail, mailText } from "./email.js";
import { cleanProfile, contextFrom, changedFields, completeness, FIELD } from "../../site/org/schema.js";
import { extractFromText, researchUrl } from "./extract.js";
import { generateIdeas, listIdeas, updateIdea } from "./ideas.js";

export const ROLES = { viewer: 1, editor: 2, owner: 3 };

async function membership(db, orgId, userId) {
  return db.prepare("SELECT m.role, o.id, o.name, o.profile_version FROM org_members m JOIN organizations o ON o.id = m.org_id WHERE m.org_id = ? AND m.user_id = ?").bind(orgId, userId).first();
}
export async function requireRole(db, orgId, user, min) {
  if (!user) throw new HttpError(401, "signin");
  if (!/^[0-9a-f]{24}$/.test(orgId || "")) throw new HttpError(404, "not_found");
  const m = await membership(db, orgId, user.id);
  if (!m) throw new HttpError(404, "not_found"); // same answer as a missing organisation
  if (ROLES[m.role] < ROLES[min]) throw new HttpError(403, "role");
  return m;
}

async function currentProfile(db, org) {
  if (!org.profile_version) return { version: 0, profile: {} };
  const v = await db.prepare("SELECT profile, created_at, changed_by FROM profile_versions WHERE org_id = ? AND version = ?").bind(org.id, org.profile_version).first();
  return { version: org.profile_version, profile: v ? JSON.parse(v.profile) : {}, updatedAt: v && v.created_at };
}

async function saveProfile(db, org, user, profile, baseVersion, note, now) {
  const prev = await currentProfile(db, org);
  if (baseVersion !== undefined && baseVersion !== prev.version) throw new HttpError(409, "version_conflict", { version: prev.version });
  const changed = changedFields(prev.profile, profile);
  const metaChanged = JSON.stringify(prev.profile._meta || {}) !== JSON.stringify(profile._meta || {});
  if (!changed.length && !metaChanged) return { version: prev.version, changed };
  const v = prev.version + 1;
  // Conditional update: a concurrent save of the same base version fails instead of overwriting.
  const res = await db.batch([
    db.prepare("UPDATE organizations SET profile_version = ?, updated_at = ?, name = COALESCE(?, name) WHERE id = ? AND profile_version = ?").bind(v, now, profile.name || null, org.id, prev.version),
    db.prepare("INSERT INTO profile_versions (org_id, version, profile, changed, changed_by, note, created_at) SELECT ?, ?, ?, ?, ?, ?, ? WHERE changes() = 1")
      .bind(org.id, v, JSON.stringify(profile), JSON.stringify(changed), user.id, note ? String(note).slice(0, 200) : null, now),
  ]);
  if (!res[0].meta || res[0].meta.changes !== 1) throw new HttpError(409, "version_conflict");
  return { version: v, changed };
}

async function deleteOrg(db, orgId) {
  await db.batch(["profile_versions", "extractions", "project_ideas", "org_invites", "org_members"].map((t) => db.prepare(`DELETE FROM ${t} WHERE org_id = ?`).bind(orgId))
    .concat([db.prepare("DELETE FROM organizations WHERE id = ?").bind(orgId)]));
}

const orgSummary = async (db, m) => {
  const cur = await currentProfile(db, m);
  return { id: m.id, name: m.name, role: m.role, version: cur.version, completeness: completeness(cur.profile).pct, updatedAt: cur.updatedAt || null };
};

export async function handleApi({ request, env, now = Date.now(), fetchImpl = fetch, waitUntil = (p) => p }) {
  try {
    if (!env.DB) throw new HttpError(503, "db_unavailable");
    checkCsrf(request);
    const url = new URL(request.url);
    if (!url.pathname.startsWith("/api/")) throw new HttpError(404, "not_found");
    const parts = url.pathname.replace(/^\/api\//, "").split("/").filter(Boolean).map(decodeURIComponent);
    const M = request.method;
    const db = env.DB;
    const body = ["POST", "PUT", "PATCH"].includes(M) ? await readJson(request, parts[2] === "extract" ? 140000 : 64000) : {};

    // ----- sign-in -----
    if (parts[0] === "auth") {
      if (M === "GET" && parts[1] === "google" && !parts[2]) return await googleStart({ request, env });
      if (M === "GET" && parts[1] === "google" && parts[2] === "callback") return await googleCallback({ request, env, now, fetchImpl });
      if (M === "POST" && parts[1] === "request") return await requestLink({ request, env, body, now, fetchImpl });
      if (M === "POST" && parts[1] === "verify") return await verifyLink({ env, body, now });
      if (M === "POST" && parts[1] === "logout") return await logout(env, await currentUser(request, env, now));
      throw new HttpError(404, "not_found");
    }

    const user = await currentUser(request, env, now);

    // ----- account -----
    if (parts[0] === "me" && parts.length === 1) {
      if (M === "GET") {
        if (!user) return json({ user: null, signin: { google: !!(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET), email: env.EMAIL_LOGIN === "1" } });
        const rows = (await db.prepare("SELECT o.id, o.name, o.profile_version, m.role FROM org_members m JOIN organizations o ON o.id = m.org_id WHERE m.user_id = ? ORDER BY o.name").bind(user.id).all()).results || [];
        const orgs = []; for (const r of rows) orgs.push(await orgSummary(db, r));
        return json({ user: { id: user.id, email: user.email, lang: user.lang, news: user.news, createdAt: user.createdAt }, orgs });
      }
      if (!user) throw new HttpError(401, "signin");
      if (M === "PATCH") {
        if (typeof body.news === "boolean") await db.prepare("UPDATE users SET news_opt_in = ?, news_opt_in_at = ? WHERE id = ?").bind(body.news ? 1 : 0, body.news ? now : null, user.id).run();
        if (body.lang === "en" || body.lang === "sr") await db.prepare("UPDATE users SET lang = ? WHERE id = ?").bind(body.lang, user.id).run();
        return json({ ok: true });
      }
      if (M === "DELETE") {
        // Organisations this user owns alone: deleted if nobody else is a member, otherwise ownership must move first.
        const owned = (await db.prepare("SELECT org_id FROM org_members WHERE user_id = ? AND role = 'owner'").bind(user.id).all()).results || [];
        const toDelete = [];
        for (const { org_id } of owned) {
          const other = await db.prepare("SELECT COUNT(*) AS n FROM org_members WHERE org_id = ? AND user_id != ?").bind(org_id, user.id).first();
          const owners = await db.prepare("SELECT COUNT(*) AS n FROM org_members WHERE org_id = ? AND role = 'owner' AND user_id != ?").bind(org_id, user.id).first();
          if (other.n === 0) toDelete.push(org_id);
          else if (owners.n === 0) throw new HttpError(409, "transfer_ownership", { orgId: org_id });
        }
        for (const id of toDelete) await deleteOrg(db, id);
        await db.batch([
          db.prepare("DELETE FROM org_members WHERE user_id = ?").bind(user.id),
          db.prepare("DELETE FROM sessions WHERE user_id = ?").bind(user.id),
          db.prepare("DELETE FROM ai_usage WHERE user_id = ?").bind(user.id),
          db.prepare("DELETE FROM login_tokens WHERE email = ?").bind(user.email),
          db.prepare("DELETE FROM users WHERE id = ?").bind(user.id),
        ]);
        return json({ ok: true, deletedOrgs: toDelete.length }, 200, { "set-cookie": "ec_session=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0" });
      }
      throw new HttpError(405, "method");
    }

    // ----- admin: user list for the site owners (ADMIN_EMAILS, comma separated) -----
    if (parts[0] === "admin") {
      const admins = String(env.ADMIN_EMAILS || "").split(",").map((x) => x.trim().toLowerCase()).filter(Boolean);
      if (!user || !admins.includes(user.email)) throw new HttpError(404, "not_found");
      if (M === "GET" && parts[1] === "users.csv") {
        const rows = (await db.prepare("SELECT email, created_at, last_login_at, lang, news_opt_in, news_opt_in_at, terms_version FROM users ORDER BY created_at").all()).results || [];
        const iso = (t) => (t ? new Date(t).toISOString() : "");
        const q = (s) => `"${String(s).replace(/"/g, '""')}"`;
        const csv = ["email,created,last_login,language,news_opt_in,news_opt_in_at,privacy_notice_version",
          ...rows.map((r) => [q(r.email), iso(r.created_at), iso(r.last_login_at), r.lang, r.news_opt_in ? "yes" : "no", iso(r.news_opt_in_at), r.terms_version].join(","))].join("\n");
        return new Response(csv, { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": "attachment; filename=eligiblecalls-users.csv", "cache-control": "no-store" } });
      }
      throw new HttpError(404, "not_found");
    }

    if (parts[0] !== "orgs") throw new HttpError(404, "not_found");
    if (!user) throw new HttpError(401, "signin");

    // ----- organisations -----
    if (parts.length === 1) {
      if (M === "GET") {
        const rows = (await db.prepare("SELECT o.id, o.name, o.profile_version, m.role FROM org_members m JOIN organizations o ON o.id = m.org_id WHERE m.user_id = ? ORDER BY o.name").bind(user.id).all()).results || [];
        const out = []; for (const r of rows) out.push(await orgSummary(db, r));
        return json({ orgs: out });
      }
      if (M === "POST") {
        const name = String(body.name || "").trim().slice(0, 200);
        if (!name) throw new HttpError(400, "name");
        const n = await db.prepare("SELECT COUNT(*) AS n FROM org_members WHERE user_id = ? AND role = 'owner'").bind(user.id).first();
        if (n.n >= (+env.MAX_ORGS_PER_USER || 10)) throw new HttpError(429, "too_many_orgs");
        const id = randomId();
        await db.batch([
          db.prepare("INSERT INTO organizations (id, name, created_by, created_at, updated_at, profile_version) VALUES (?, ?, ?, ?, ?, 0)").bind(id, name, user.id, now, now),
          db.prepare("INSERT INTO org_members (org_id, user_id, role, added_by, created_at) VALUES (?, ?, 'owner', ?, ?)").bind(id, user.id, user.id, now),
        ]);
        const org = { id, name, profile_version: 0 };
        await saveProfile(db, org, user, { name }, 0, "created", now);
        return json({ id, name, role: "owner" }, 201);
      }
      throw new HttpError(405, "method");
    }

    const orgId = parts[1];
    const sub = parts[2] || "";

    if (!sub) {
      if (M === "GET") {
        const m = await requireRole(db, orgId, user, "viewer");
        const cur = await currentProfile(db, m);
        return json({ id: m.id, name: m.name, role: m.role, version: cur.version, profile: cur.profile, updatedAt: cur.updatedAt || null, completeness: completeness(cur.profile) });
      }
      if (M === "DELETE") {
        await requireRole(db, orgId, user, "owner");
        await deleteOrg(db, orgId);
        return json({ ok: true });
      }
      throw new HttpError(405, "method");
    }

    if (sub === "profile" && M === "PUT") {
      const m = await requireRole(db, orgId, user, "editor");
      const ctx = contextFrom(await taxonomy(env, request.url), new Date(now).getUTCFullYear());
      const { profile, errors } = cleanProfile(body.profile, ctx);
      if (Object.keys(errors).length) throw new HttpError(400, "invalid", { fields: errors });
      if (!profile.name) throw new HttpError(400, "invalid", { fields: { name: "required" } });
      const r = await saveProfile(db, m, user, profile, Number.isInteger(body.baseVersion) ? body.baseVersion : undefined, body.note, now);
      return json({ ok: true, version: r.version, changed: r.changed, completeness: completeness(profile) });
    }

    if (sub === "versions" && M === "GET") {
      await requireRole(db, orgId, user, "viewer");
      if (parts[3]) {
        const v = await db.prepare("SELECT version, profile, changed, note, created_at FROM profile_versions WHERE org_id = ? AND version = ?").bind(orgId, +parts[3]).first();
        if (!v) throw new HttpError(404, "not_found");
        return json({ version: v.version, profile: JSON.parse(v.profile), changed: JSON.parse(v.changed), note: v.note, at: v.created_at });
      }
      const rows = (await db.prepare("SELECT v.version, v.changed, v.note, v.created_at, u.email FROM profile_versions v LEFT JOIN users u ON u.id = v.changed_by WHERE v.org_id = ? ORDER BY v.version DESC LIMIT 100").bind(orgId).all()).results || [];
      return json({ versions: rows.map((r) => ({ version: r.version, changed: JSON.parse(r.changed), note: r.note, at: r.created_at, by: r.email || null })) });
    }

    if (sub === "members") {
      const m = await requireRole(db, orgId, user, M === "GET" ? "viewer" : "owner");
      if (M === "GET") {
        const members = (await db.prepare("SELECT u.id, u.email, m.role, m.created_at FROM org_members m JOIN users u ON u.id = m.user_id WHERE m.org_id = ? ORDER BY m.created_at").bind(orgId).all()).results || [];
        const invites = (await db.prepare("SELECT email, role, created_at FROM org_invites WHERE org_id = ? ORDER BY created_at").bind(orgId).all()).results || [];
        return json({ members, invites });
      }
      if (M === "POST" && !parts[3]) {
        const email = cleanEmail(body.email);
        const role = ROLES[body.role] ? body.role : null;
        if (!email || !role) throw new HttpError(400, "invalid");
        const existing = await db.prepare("SELECT id FROM users WHERE email = ?").bind(email).first();
        if (existing) await db.prepare("INSERT INTO org_members (org_id, user_id, role, added_by, created_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT(org_id, user_id) DO UPDATE SET role = excluded.role").bind(orgId, existing.id, role, user.id, now).run();
        else await db.prepare("INSERT INTO org_invites (org_id, email, role, invited_by, created_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT(org_id, email) DO UPDATE SET role = excluded.role").bind(orgId, email, role, user.id, now).run();
        const T = mailText(body.lang);
        const sent = env.DEV_LOGIN_LINKS === "1" ? { sent: false } : await sendEmail(env, { to: email, subject: T.inviteSubject(m.name), text: T.inviteBody(m.name, (env.SITE_URL || url.origin) + "/#org") }, fetchImpl).catch(() => ({ sent: false }));
        return json({ ok: true, added: !!existing, invited: !existing, emailed: sent.sent }, 201);
      }
      if (parts[3] === "invites" && M === "DELETE") {
        await db.prepare("DELETE FROM org_invites WHERE org_id = ? AND email = ?").bind(orgId, String(parts[4] || "").toLowerCase()).run();
        return json({ ok: true });
      }
      const target = parts[3];
      if (target && (M === "PATCH" || M === "DELETE")) {
        const owners = await db.prepare("SELECT COUNT(*) AS n FROM org_members WHERE org_id = ? AND role = 'owner' AND user_id != ?").bind(orgId, target).first();
        const t = await db.prepare("SELECT role FROM org_members WHERE org_id = ? AND user_id = ?").bind(orgId, target).first();
        if (!t) throw new HttpError(404, "not_found");
        if (t.role === "owner" && owners.n === 0 && (M === "DELETE" || body.role !== "owner")) throw new HttpError(409, "last_owner");
        if (M === "PATCH") {
          if (!ROLES[body.role]) throw new HttpError(400, "invalid");
          await db.prepare("UPDATE org_members SET role = ? WHERE org_id = ? AND user_id = ?").bind(body.role, orgId, target).run();
        } else await db.prepare("DELETE FROM org_members WHERE org_id = ? AND user_id = ?").bind(orgId, target).run();
        return json({ ok: true });
      }
      throw new HttpError(405, "method");
    }

    // Any member may leave, except the last owner.
    if (sub === "leave" && M === "POST") {
      const m = await requireRole(db, orgId, user, "viewer");
      if (m.role === "owner") {
        const owners = await db.prepare("SELECT COUNT(*) AS n FROM org_members WHERE org_id = ? AND role = 'owner' AND user_id != ?").bind(orgId, user.id).first();
        if (owners.n === 0) throw new HttpError(409, "last_owner");
      }
      await db.prepare("DELETE FROM org_members WHERE org_id = ? AND user_id = ?").bind(orgId, user.id).run();
      return json({ ok: true });
    }

    if (sub === "extract" && M === "POST") {
      const m = await requireRole(db, orgId, user, "editor");
      return await extractFromText({ env, db, org: m, user, body, now, fetchImpl, waitUntil, url: request.url });
    }
    if (sub === "research" && M === "POST") {
      const m = await requireRole(db, orgId, user, "editor");
      return await researchUrl({ env, db, org: m, user, body, now, fetchImpl, waitUntil, url: request.url });
    }

    // ----- project ideas -----
    if (sub === "ideas") {
      if (M === "GET" && !parts[3]) { await requireRole(db, orgId, user, "viewer"); return json({ ideas: await listIdeas(db, orgId) }); }
      const m = await requireRole(db, orgId, user, "editor");
      if (M === "POST" && !parts[3]) {
        const cur = await currentProfile(db, m);
        return await generateIdeas({ env, db, org: m, user, profile: cur.profile, version: cur.version, body, now, fetchImpl, waitUntil, url: request.url });
      }
      if (M === "PATCH" && parts[3]) return await updateIdea(db, orgId, parts[3], body, now);
      if (M === "DELETE" && parts[3]) {
        await db.prepare("DELETE FROM project_ideas WHERE id = ? AND org_id = ?").bind(parts[3], orgId).run();
        return json({ ok: true });
      }
      throw new HttpError(405, "method");
    }

    if (sub === "extractions") {
      await requireRole(db, orgId, user, M === "GET" ? "viewer" : "editor");
      if (M === "GET") {
        const rows = (await db.prepare("SELECT id, kind, source_name, source_url, fields, status, created_at FROM extractions WHERE org_id = ? ORDER BY created_at DESC LIMIT 50").bind(orgId).all()).results || [];
        return json({ extractions: rows.map((r) => ({ id: r.id, kind: r.kind, sourceName: r.source_name, sourceUrl: r.source_url, fields: JSON.parse(r.fields), status: r.status, at: r.created_at })) });
      }
      const eid = parts[3];
      if (M === "PATCH" && eid && ["applied", "discarded", "review"].includes(body.status)) {
        await db.prepare("UPDATE extractions SET status = ? WHERE id = ? AND org_id = ?").bind(body.status, eid, orgId).run();
        return json({ ok: true });
      }
      if (M === "DELETE" && eid) {
        await db.prepare("DELETE FROM extractions WHERE id = ? AND org_id = ?").bind(eid, orgId).run();
        return json({ ok: true });
      }
      throw new HttpError(405, "method");
    }

    throw new HttpError(404, "not_found");
  } catch (e) {
    if (e instanceof HttpError) return fail(e.status, e.code, e.extra);
    console.error("org api", e && e.stack ? e.stack : e);
    return fail(500, "server_error");
  }
}

export { FIELD };
