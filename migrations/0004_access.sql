-- Organization Intelligence: automatic profile fill, detailed proposals, Erasmus+ evaluation, premium access.
-- Only additions; existing data is kept.

ALTER TABLE users ADD COLUMN name TEXT;
ALTER TABLE users ADD COLUMN idea_runs INTEGER NOT NULL DEFAULT 0;
ALTER TABLE extractions ADD COLUMN result TEXT;
ALTER TABLE project_ideas ADD COLUMN proposal TEXT;
ALTER TABLE project_ideas ADD COLUMN evaluations TEXT;
-- Generations made before the paywall count as used.
UPDATE users SET idea_runs = (SELECT COUNT(DISTINCT batch_id) FROM project_ideas WHERE project_ideas.created_by = users.id);

-- Premium access: one row per request; the newest row of a user decides the user's access.
CREATE TABLE IF NOT EXISTS access_requests (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  org_id TEXT,                              -- organisation the user was working in when asking
  service TEXT NOT NULL,                    -- what was asked for, e.g. 'project_ideas'
  plan TEXT,                                -- plan id from the subscription settings
  status TEXT NOT NULL CHECK (status IN ('pending_payment', 'payment_submitted', 'active', 'rejected', 'revoked', 'expired')),
  payment_ref TEXT,                         -- reference the user gave for the payment
  admin_note TEXT,
  requested_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  paid_at INTEGER,                          -- when the user reported the payment
  granted_at INTEGER,
  expires_at INTEGER,                       -- NULL = no end date
  decided_by TEXT,                          -- admin user id
  notified INTEGER NOT NULL DEFAULT 0,      -- admin e-mail sent
  notify_error TEXT
);
CREATE INDEX IF NOT EXISTS access_requests_user ON access_requests (user_id, requested_at);
CREATE INDEX IF NOT EXISTS access_requests_status ON access_requests (status, updated_at);

-- Settings the administrator edits in the admin dashboard (JSON values), e.g. 'subscription'.
CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at INTEGER NOT NULL,
  updated_by TEXT
);
