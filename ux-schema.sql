-- Dedicated Cloudflare D1 database only. Never run against the community DB.
CREATE TABLE IF NOT EXISTS ux_events (
  session_id TEXT NOT NULL,
  seq INTEGER NOT NULL,
  at INTEGER NOT NULL,
  received_at INTEGER NOT NULL,
  device TEXT NOT NULL,
  is_test INTEGER NOT NULL CHECK(is_test IN (0,1)),
  kind TEXT NOT NULL,
  screen TEXT NOT NULL,
  action TEXT,
  value INTEGER,
  target TEXT,
  PRIMARY KEY(session_id,seq)
);
CREATE INDEX IF NOT EXISTS ux_events_received ON ux_events(received_at,is_test);
-- Additive/idempotent migration. Historical visits have no recorded IP.
CREATE TABLE IF NOT EXISTS ux_visit_ips(session_id TEXT PRIMARY KEY,ip TEXT,last_seen INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS ux_visit_ips_seen ON ux_visit_ips(last_seen);
CREATE TABLE IF NOT EXISTS ux_quotas(day INTEGER NOT NULL,scope TEXT NOT NULL,total INTEGER NOT NULL DEFAULT 0,PRIMARY KEY(day,scope));
CREATE TRIGGER IF NOT EXISTS ux_quota_guard BEFORE INSERT ON ux_events BEGIN
  SELECT CASE WHEN (SELECT total FROM ux_quotas WHERE day=CAST(NEW.received_at/86400000 AS INTEGER) AND scope='all')>=20000
    OR (SELECT total FROM ux_quotas WHERE day=CAST(NEW.received_at/86400000 AS INTEGER) AND scope=NEW.session_id)>=3000
    THEN RAISE(ABORT,'ux_limit') END;
END;
CREATE TRIGGER IF NOT EXISTS ux_quota_count AFTER INSERT ON ux_events BEGIN
  INSERT INTO ux_quotas(day,scope,total) VALUES(CAST(NEW.received_at/86400000 AS INTEGER),'all',1) ON CONFLICT(day,scope) DO UPDATE SET total=total+1;
  INSERT INTO ux_quotas(day,scope,total) VALUES(CAST(NEW.received_at/86400000 AS INTEGER),NEW.session_id,1) ON CONFLICT(day,scope) DO UPDATE SET total=total+1;
END;
