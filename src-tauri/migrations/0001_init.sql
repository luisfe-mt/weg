-- Baseline. Tables for cards, reviews, the hours ledger and the error log
-- arrive with the tickets that build them, one migration each.
CREATE TABLE app_meta (
  key   TEXT PRIMARY KEY NOT NULL,
  value TEXT NOT NULL
) STRICT;

INSERT INTO app_meta (key, value) VALUES ('installed_at', datetime('now'));
