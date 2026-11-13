-- Assistant usage counters (the tables that existed before Organization Intelligence).
CREATE TABLE IF NOT EXISTS usage (
  day TEXT NOT NULL, provider TEXT NOT NULL, neurons REAL NOT NULL DEFAULT 0, tokens INTEGER NOT NULL DEFAULT 0, requests INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (day, provider)
);
CREATE TABLE IF NOT EXISTS visitor_usage (
  day TEXT NOT NULL, vhash TEXT NOT NULL, count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (day, vhash)
);
