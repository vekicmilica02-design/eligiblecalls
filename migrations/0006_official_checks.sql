-- AI checks of an organisation profile against the official eligibility text of a call (src/org/official.js).
-- One row per organisation and call; a new check replaces the old one. Only additions; existing data is kept.

CREATE TABLE IF NOT EXISTS official_checks (
  org_id TEXT NOT NULL,
  call_id TEXT NOT NULL,
  profile_version INTEGER NOT NULL,         -- profile version the check was made with
  source_url TEXT,                          -- official document or page the text comes from
  source_title TEXT,
  source_verified TEXT,                     -- date the text was last read from the official source
  result TEXT NOT NULL,                     -- JSON: conditions (quote, result, field, reason), summary, language
  model TEXT,
  created_by TEXT,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (org_id, call_id)
);
