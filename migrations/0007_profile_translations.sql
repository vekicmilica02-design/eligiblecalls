-- English copy of an organisation profile's free text (description, mission, objectives, expertise), used for the
-- thematic match against English call texts (src/org/translate.js). One row per organisation and field.
-- Only additions; existing data is kept.

CREATE TABLE IF NOT EXISTS profile_translations (
  org_id TEXT NOT NULL,
  field TEXT NOT NULL,                      -- description | mission | objectives | expertise
  text_en TEXT NOT NULL,                    -- the English copy
  source_hash TEXT NOT NULL,                -- fingerprint of the original text the copy was made from or edited against
  source_lang TEXT,                         -- language of the original (sr, other), detected without a model
  from_version INTEGER NOT NULL,            -- profile version the copy was made from
  edited INTEGER NOT NULL DEFAULT 0,        -- 1 = written or changed by a user; never replaced automatically
  model TEXT,                               -- model that made an automatic copy
  created_by TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (org_id, field)
);
