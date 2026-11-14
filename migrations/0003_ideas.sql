-- Organization Intelligence, phase 4: project ideas. Only additions; existing tables are untouched.
-- An idea belongs to one organisation and names one call (call_id = the call's id in site/data/calls.json).
-- Suggested ideas are replaced by the next generation; saved ideas stay until a member deletes them.

CREATE TABLE IF NOT EXISTS project_ideas (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  batch_id TEXT NOT NULL,                   -- one generation run
  call_id TEXT NOT NULL,
  rank INTEGER NOT NULL,                    -- position in its generation run
  status TEXT NOT NULL DEFAULT 'suggested' CHECK (status IN ('suggested', 'saved')),
  idea TEXT NOT NULL,                       -- JSON: title, concept, problem, solution, objectives, target groups, activities, results, partners, why it fits, fit ratings
  match TEXT,                               -- JSON: rule-based score and status at generation, concept fit, rank score
  notes TEXT,                               -- members' notes
  lang TEXT NOT NULL DEFAULT 'en',
  profile_version INTEGER NOT NULL,         -- profile version the idea was generated from
  call_title TEXT,
  call_deadline TEXT,
  model TEXT,
  created_by TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS project_ideas_org ON project_ideas (org_id, status, created_at);
