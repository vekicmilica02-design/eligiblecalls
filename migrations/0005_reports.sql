-- Saved reports: snapshots of one call's eligibility assessment, kept per organisation.
-- Only additions; existing data is kept.

CREATE TABLE IF NOT EXISTS reports (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  call_key TEXT NOT NULL,
  call_title TEXT NOT NULL,
  programme TEXT,
  deadline TEXT,                            -- next deadline when saved (YYYY-MM-DD)
  score INTEGER NOT NULL,                   -- compatibility score 0-100 when saved
  status TEXT NOT NULL,                     -- eligible | potential | insufficient | ineligible
  profile_version INTEGER,                  -- profile version the assessment used
  data_generated TEXT,                      -- date of the call data
  data TEXT NOT NULL,                       -- JSON snapshot: call, assessment (checks, strengths, gaps, missing, next steps)
  note TEXT,
  created_by TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS reports_org ON reports (org_id, created_at);
