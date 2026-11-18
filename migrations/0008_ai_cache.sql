-- Stored AI answers for document and web-page extraction, so the same text read again uses no AI action
-- (src/org/ai.js). One row per organisation and prompt fingerprint; rows older than AI_CACHE_DAYS (default 30) are
-- not used and are removed over time. The answer can quote the organisation's documents, so rows are deleted with
-- the organisation. Only additions; existing data is kept.

CREATE TABLE IF NOT EXISTS ai_cache (
  org_id TEXT NOT NULL,
  key TEXT NOT NULL,                        -- SHA-256 of the agent, output limit and the full prompt
  agent TEXT NOT NULL,                      -- extract | research
  text TEXT NOT NULL,                       -- the model's answer
  model TEXT,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (org_id, key)
);
CREATE INDEX IF NOT EXISTS ai_cache_created ON ai_cache (created_at);
