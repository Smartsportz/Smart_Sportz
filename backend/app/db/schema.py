from __future__ import annotations

from app.core.config import settings
from app.db.database import connect, ensure_storage, sync_mirror, using_postgres


SCHEMA = """
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sports (
  slug TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  active INTEGER NOT NULL,
  color TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS tournaments (
  slug TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  sport TEXT NOT NULL,
  status TEXT NOT NULL,
  location TEXT NOT NULL,
  date TEXT NOT NULL,
  registration_start TEXT NOT NULL DEFAULT '',
  registration_end TEXT NOT NULL DEFAULT '',
  teams INTEGER NOT NULL,
  capacity INTEGER NOT NULL,
  team_size INTEGER NOT NULL DEFAULT 16,
  prize TEXT NOT NULL,
  image TEXT NOT NULL,
  accent TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS tournament_prizes (
  id TEXT PRIMARY KEY,
  tournament_slug TEXT NOT NULL,
  position INTEGER NOT NULL,
  label TEXT NOT NULL,
  amount INTEGER NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 1,
  UNIQUE(tournament_slug, position),
  FOREIGN KEY(tournament_slug) REFERENCES tournaments(slug)
);

CREATE TABLE IF NOT EXISTS tournament_cities (
  id TEXT PRIMARY KEY,
  tournament_slug TEXT NOT NULL,
  city TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  UNIQUE(tournament_slug, city),
  FOREIGN KEY(tournament_slug) REFERENCES tournaments(slug)
);

CREATE TABLE IF NOT EXISTS teams (
  slug TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  rank TEXT NOT NULL,
  sport TEXT NOT NULL,
  players INTEGER NOT NULL,
  wins INTEGER NOT NULL,
  rating INTEGER NOT NULL,
  image TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS live_matches (
  id TEXT PRIMARY KEY,
  tournament TEXT NOT NULL,
  sport TEXT NOT NULL,
  home TEXT NOT NULL,
  away TEXT NOT NULL,
  score TEXT NOT NULL,
  away_score TEXT NOT NULL,
  stage TEXT NOT NULL,
  status TEXT NOT NULL,
  image TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS timeline_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  match_id TEXT NOT NULL,
  time TEXT NOT NULL,
  type TEXT NOT NULL,
  text TEXT NOT NULL,
  score TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY(match_id) REFERENCES live_matches(id)
);

CREATE TABLE IF NOT EXISTS registrations (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL DEFAULT '',
  tournament_slug TEXT NOT NULL,
  team_name TEXT NOT NULL,
  team_code TEXT NOT NULL DEFAULT '',
  captain_name TEXT NOT NULL,
  sub_captain_name TEXT NOT NULL DEFAULT '',
  coach_name TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  city TEXT NOT NULL DEFAULT '',
  district_state TEXT NOT NULL DEFAULT '',
  team_logo TEXT NOT NULL DEFAULT '',
  primary_jersey_color TEXT NOT NULL DEFAULT '#0b8852',
  secondary_jersey_color TEXT NOT NULL DEFAULT '#ffffff',
  team_motto TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT '',
  confirmation_code TEXT NOT NULL DEFAULT '',
  confirmation_qr_payload TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL,
  payment_status TEXT NOT NULL,
  amount INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY(tournament_slug) REFERENCES tournaments(slug)
);

CREATE TABLE IF NOT EXISTS registration_members (
  id TEXT PRIMARY KEY,
  registration_id TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL,
  jersey TEXT,
  contact TEXT,
  FOREIGN KEY(registration_id) REFERENCES registrations(id)
);

CREATE TABLE IF NOT EXISTS registration_documents (
  id TEXT PRIMARY KEY,
  registration_id TEXT NOT NULL,
  document_type TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  status TEXT NOT NULL,
  uploaded_at TEXT NOT NULL,
  FOREIGN KEY(registration_id) REFERENCES registrations(id)
);

CREATE TABLE IF NOT EXISTS payments (
  id TEXT PRIMARY KEY,
  registration_id TEXT NOT NULL,
  status TEXT NOT NULL,
  amount INTEGER NOT NULL,
  method TEXT NOT NULL,
  receipt_number TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY(registration_id) REFERENCES registrations(id)
);

CREATE TABLE IF NOT EXISTS payment_intents (
  id TEXT PRIMARY KEY,
  tournament_slug TEXT NOT NULL,
  team_name TEXT NOT NULL,
  amount INTEGER NOT NULL,
  method TEXT NOT NULL,
  contact TEXT NOT NULL,
  status TEXT NOT NULL,
  receipt_number TEXT NOT NULL,
  qr_payload TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY(tournament_slug) REFERENCES tournaments(slug)
);

CREATE TABLE IF NOT EXISTS bracket_nodes (
  id TEXT PRIMARY KEY,
  tournament_slug TEXT NOT NULL,
  label TEXT NOT NULL,
  team TEXT,
  round TEXT NOT NULL,
  x INTEGER NOT NULL,
  y INTEGER NOT NULL,
  status TEXT NOT NULL,
  FOREIGN KEY(tournament_slug) REFERENCES tournaments(slug)
);

CREATE TABLE IF NOT EXISTS bracket_connections (
  id TEXT PRIMARY KEY,
  tournament_slug TEXT NOT NULL,
  source_id TEXT NOT NULL,
  target_id TEXT NOT NULL,
  FOREIGN KEY(tournament_slug) REFERENCES tournaments(slug)
);

CREATE TABLE IF NOT EXISTS notification_events (
  id TEXT PRIMARY KEY,
  tournament_slug TEXT NOT NULL,
  audience TEXT NOT NULL,
  channels TEXT NOT NULL,
  message TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY(tournament_slug) REFERENCES tournaments(slug)
);

CREATE TABLE IF NOT EXISTS cms_content (
  slug TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  type TEXT NOT NULL,
  body TEXT NOT NULL,
  path TEXT NOT NULL,
  published INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS news_posts (
  slug TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  short_description TEXT NOT NULL,
  image TEXT NOT NULL,
  category TEXT NOT NULL,
  sport TEXT NOT NULL,
  tournament_slug TEXT,
  city TEXT NOT NULL,
  status TEXT NOT NULL,
  author_id TEXT,
  published_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY(tournament_slug) REFERENCES tournaments(slug),
  FOREIGN KEY(author_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS news_blocks (
  id TEXT PRIMARY KEY,
  post_slug TEXT NOT NULL,
  block_type TEXT NOT NULL,
  content_json TEXT NOT NULL,
  sort_order INTEGER NOT NULL,
  FOREIGN KEY(post_slug) REFERENCES news_posts(slug)
);

CREATE TABLE IF NOT EXISTS sport_home_visibility (
  sport_slug TEXT PRIMARY KEY,
  show_on_home INTEGER NOT NULL,
  sort_order INTEGER NOT NULL,
  updated_by TEXT,
  FOREIGN KEY(sport_slug) REFERENCES sports(slug),
  FOREIGN KEY(updated_by) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS manager_city_assignments (
  id TEXT PRIMARY KEY,
  manager_user_id TEXT NOT NULL,
  city TEXT NOT NULL,
  UNIQUE(manager_user_id, city),
  FOREIGN KEY(manager_user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS leaderboard_records (
  id TEXT PRIMARY KEY,
  sport TEXT NOT NULL,
  team_name TEXT NOT NULL,
  city TEXT NOT NULL,
  rank INTEGER NOT NULL,
  tournaments_won INTEGER NOT NULL,
  win_rate INTEGER NOT NULL,
  points INTEGER NOT NULL,
  record_label TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  actor TEXT NOT NULL,
  action TEXT NOT NULL,
  entity TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  message TEXT NOT NULL,
  created_at TEXT NOT NULL
);
"""

MIRROR_METADATA_SCHEMA = """
CREATE TABLE IF NOT EXISTS mirror_sync_batches (
  batch_id TEXT PRIMARY KEY,
  source_updated_at TEXT NOT NULL,
  mirrored_at TEXT NOT NULL,
  backup_status TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS mirror_table_checksums (
  table_name TEXT PRIMARY KEY,
  checksum TEXT NOT NULL,
  row_count INTEGER NOT NULL,
  mirrored_at TEXT NOT NULL
);
"""

AUDIT_SCHEMA = """
CREATE TABLE IF NOT EXISTS audit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  actor TEXT NOT NULL,
  action TEXT NOT NULL,
  entity TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  message TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS login_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  actor TEXT NOT NULL,
  status TEXT NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  message TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS security_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  severity TEXT NOT NULL,
  event_type TEXT NOT NULL,
  actor TEXT,
  entity TEXT,
  entity_id TEXT,
  message TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS webhook_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  provider TEXT NOT NULL,
  event_type TEXT NOT NULL,
  reference_id TEXT,
  status TEXT NOT NULL,
  message TEXT NOT NULL,
  created_at TEXT NOT NULL
);
"""


def _postgres_ddl(sql: str) -> str:
    return sql.replace("INTEGER PRIMARY KEY AUTOINCREMENT", "INTEGER GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY")


def _executescript(conn, sql: str) -> None:
    script = _postgres_ddl(sql) if using_postgres() else sql
    if hasattr(conn, "executescript"):
        conn.executescript(script)
        return
    for statement in script.split(";"):
        cleaned = statement.strip()
        if cleaned:
            conn.execute(cleaned)


def _column_exists(conn, table: str, column: str) -> bool:
    if using_postgres():
        result = conn.execute(
            "SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = %s AND column_name = %s",
            (table, column),
        ).fetchone()
        return bool(result)
    columns = [row[1] for row in conn.execute(f"PRAGMA table_info({table})").fetchall()]
    return column in columns


def _add_column(conn, table: str, column: str, definition: str) -> None:
    if _column_exists(conn, table, column):
        return
    conn.execute(f"ALTER TABLE {table} ADD COLUMN {column} {definition}")


def _apply_operational_schema(path=None) -> None:
    with connect(path) as conn:
        _executescript(conn, SCHEMA)
        registration_columns = {
            "user_id": "TEXT NOT NULL DEFAULT ''",
            "team_code": "TEXT NOT NULL DEFAULT ''",
            "sub_captain_name": "TEXT NOT NULL DEFAULT ''",
            "coach_name": "TEXT NOT NULL DEFAULT ''",
            "district_state": "TEXT NOT NULL DEFAULT ''",
            "team_logo": "TEXT NOT NULL DEFAULT ''",
            "primary_jersey_color": "TEXT NOT NULL DEFAULT '#0b8852'",
            "secondary_jersey_color": "TEXT NOT NULL DEFAULT '#ffffff'",
            "team_motto": "TEXT NOT NULL DEFAULT ''",
            "category": "TEXT NOT NULL DEFAULT ''",
            "confirmation_code": "TEXT NOT NULL DEFAULT ''",
            "confirmation_qr_payload": "TEXT NOT NULL DEFAULT ''",
        }
        for column, definition in registration_columns.items():
            _add_column(conn, "registrations", column, definition)
        if using_postgres():
            conn.commit()
            return
        columns = [row[1] for row in conn.execute("PRAGMA table_info(tournaments)").fetchall()]
        if "registration_start" not in columns:
            conn.execute("ALTER TABLE tournaments ADD COLUMN registration_start TEXT NOT NULL DEFAULT ''")
        if "registration_end" not in columns:
            conn.execute("ALTER TABLE tournaments ADD COLUMN registration_end TEXT NOT NULL DEFAULT ''")
        if "team_size" not in columns:
            conn.execute("ALTER TABLE tournaments ADD COLUMN team_size INTEGER NOT NULL DEFAULT 16")
        registration_columns = [row[1] for row in conn.execute("PRAGMA table_info(registrations)").fetchall()]
        if "city" not in registration_columns:
            conn.execute("ALTER TABLE registrations ADD COLUMN city TEXT NOT NULL DEFAULT ''")
        conn.commit()


def init_schema() -> None:
    ensure_storage()
    _apply_operational_schema()
    _apply_operational_schema(settings.mirror_database_path)
    with connect(settings.mirror_database_path) as mirror:
        _executescript(mirror, MIRROR_METADATA_SCHEMA)
        mirror.commit()
    with connect(settings.audit_database_path) as audit:
        _executescript(audit, AUDIT_SCHEMA)
        audit.commit()
    if not using_postgres():
        sync_mirror()
