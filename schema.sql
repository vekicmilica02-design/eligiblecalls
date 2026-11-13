-- D1 schema. New databases: run this file. Existing databases: apply migrations/ in order
-- (npx wrangler d1 migrations apply calldar --remote), or paste the new migration into the D1 console.

-- Assistant usage counters (the tables that existed before Organization Intelligence).
CREATE TABLE IF NOT EXISTS usage (
  day TEXT NOT NULL, provider TEXT NOT NULL, neurons REAL NOT NULL DEFAULT 0, tokens INTEGER NOT NULL DEFAULT 0, requests INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (day, provider)
);
CREATE TABLE IF NOT EXISTS visitor_usage (
  day TEXT NOT NULL, vhash TEXT NOT NULL, count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (day, vhash)
);

-- Organization Intelligence: accounts, organisations, profiles, extraction results, AI usage.
-- Only additions; existing tables are untouched. Times are Unix milliseconds (UTC).
-- Uploaded documents are not stored: only the fields a user approved, with the file name as source.

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,               -- lower case
  google_sub TEXT UNIQUE,                   -- Google account id ("sub"), set at Google sign-in
  created_at INTEGER NOT NULL,
  last_login_at INTEGER,
  lang TEXT NOT NULL DEFAULT 'en',
  terms_version TEXT NOT NULL,              -- privacy notice version accepted at sign-up
  terms_at INTEGER NOT NULL,
  news_opt_in INTEGER NOT NULL DEFAULT 0,   -- separate consent for news e-mails
  news_opt_in_at INTEGER
);

CREATE TABLE IF NOT EXISTS login_tokens (
  token_hash TEXT PRIMARY KEY,              -- SHA-256 of the token in the e-mailed link; the token itself is not stored
  email TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  used_at INTEGER,
  lang TEXT NOT NULL DEFAULT 'en',
  news_opt_in INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS login_tokens_email ON login_tokens (email, created_at);

CREATE TABLE IF NOT EXISTS sessions (
  id_hash TEXT PRIMARY KEY,                 -- SHA-256 of the cookie value
  user_id TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  last_seen INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS sessions_user ON sessions (user_id);

CREATE TABLE IF NOT EXISTS rate_limits (
  day TEXT NOT NULL, key TEXT NOT NULL, count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (day, key)
);

CREATE TABLE IF NOT EXISTS organizations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  created_by TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  profile_version INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS org_members (
  org_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('owner', 'editor', 'viewer')),
  added_by TEXT,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (org_id, user_id)
);
CREATE INDEX IF NOT EXISTS org_members_user ON org_members (user_id);

CREATE TABLE IF NOT EXISTS org_invites (
  org_id TEXT NOT NULL,
  email TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('owner', 'editor', 'viewer')),
  invited_by TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (org_id, email)
);
CREATE INDEX IF NOT EXISTS org_invites_email ON org_invites (email);

CREATE TABLE IF NOT EXISTS profile_versions (
  org_id TEXT NOT NULL,
  version INTEGER NOT NULL,
  profile TEXT NOT NULL,                    -- JSON, site/org/schema.js
  changed TEXT NOT NULL,                    -- JSON list of changed field ids
  changed_by TEXT NOT NULL,
  note TEXT,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (org_id, version)
);

CREATE TABLE IF NOT EXISTS extractions (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('document', 'web')),
  source_name TEXT NOT NULL,                -- file name or page title
  source_url TEXT,
  fields TEXT NOT NULL,                     -- JSON: {field: {value, evidence, confidence, found}}
  status TEXT NOT NULL DEFAULT 'review' CHECK (status IN ('review', 'applied', 'discarded')),
  created_by TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS extractions_org ON extractions (org_id, created_at);

CREATE TABLE IF NOT EXISTS ai_usage (
  day TEXT NOT NULL, user_id TEXT NOT NULL, count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (day, user_id)
);
