-- D1 schema for the chat usage counters. Apply with:
--   npx wrangler d1 execute eligiblecalls --remote --file=schema.sql
CREATE TABLE IF NOT EXISTS usage (
  day TEXT NOT NULL,          -- UTC date, YYYY-MM-DD
  provider TEXT NOT NULL,     -- workers-ai | groq
  neurons REAL NOT NULL DEFAULT 0,
  tokens INTEGER NOT NULL DEFAULT 0,
  requests INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (day, provider)
);
CREATE TABLE IF NOT EXISTS visitor_usage (
  day TEXT NOT NULL,
  vhash TEXT NOT NULL,        -- salted SHA-256 of IP + day, first 12 bytes; the IP itself is not stored
  count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (day, vhash)
);
