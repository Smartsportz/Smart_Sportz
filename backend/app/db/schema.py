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
  phone TEXT NOT NULL DEFAULT '',
  email_verified INTEGER NOT NULL DEFAULT 1,
  phone_verified INTEGER NOT NULL DEFAULT 1,
  google_login INTEGER NOT NULL DEFAULT 0,
  google_sub TEXT NOT NULL DEFAULT '',
  avatar_url TEXT NOT NULL DEFAULT '',
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
  min_team_size INTEGER NOT NULL DEFAULT 2,
  max_team_size INTEGER NOT NULL DEFAULT 16,
  prize TEXT NOT NULL,
  image TEXT NOT NULL,
  accent TEXT NOT NULL,
  address TEXT NOT NULL DEFAULT '',
  sport_description TEXT NOT NULL DEFAULT '',
  tournament_description TEXT NOT NULL DEFAULT '',
  fee_breakdown_json TEXT NOT NULL DEFAULT '[]',
  show_on_home INTEGER NOT NULL DEFAULT 1,
  block_repeat_registration INTEGER NOT NULL DEFAULT 0
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
  image TEXT NOT NULL,
  youtube_url TEXT NOT NULL DEFAULT '',
  venue TEXT NOT NULL DEFAULT '',
  match_clock TEXT NOT NULL DEFAULT '',
  current_players_json TEXT NOT NULL DEFAULT '[]',
  substitutes_json TEXT NOT NULL DEFAULT '[]',
  player_scores_json TEXT NOT NULL DEFAULT '[]',
  team_stats_json TEXT NOT NULL DEFAULT '{}'
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

CREATE TABLE IF NOT EXISTS home_discovery_cards (
  slug TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  title TEXT NOT NULL,
  sport TEXT NOT NULL,
  tournament_slug TEXT NOT NULL DEFAULT '',
  sponsor_name TEXT NOT NULL,
  sponsor_image TEXT NOT NULL,
  image TEXT NOT NULL,
  event_date TEXT NOT NULL,
  description TEXT NOT NULL,
  sponsor_details TEXT NOT NULL,
  register_path TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 1,
  published INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS live_highlights (
  id TEXT PRIMARY KEY,
  match_id TEXT NOT NULL DEFAULT '',
  title TEXT NOT NULL,
  stage_label TEXT NOT NULL,
  home_team TEXT NOT NULL,
  away_team TEXT NOT NULL,
  home_score TEXT NOT NULL,
  away_score TEXT NOT NULL,
  image TEXT NOT NULL,
  description TEXT NOT NULL,
  impact_notes TEXT NOT NULL,
  link_path TEXT NOT NULL DEFAULT '/live',
  sort_order INTEGER NOT NULL DEFAULT 1,
  published INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS sponsor_logos (
  slug TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  image TEXT NOT NULL,
  link_url TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 1,
  published INTEGER NOT NULL DEFAULT 1
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
  is_highlight INTEGER NOT NULL DEFAULT 0,
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

CREATE TABLE IF NOT EXISTS news_social (
  news_slug TEXT PRIMARY KEY,
  likes INTEGER NOT NULL DEFAULT 0,
  comments_json TEXT NOT NULL DEFAULT '[]',
  updated_at TEXT NOT NULL,
  FOREIGN KEY(news_slug) REFERENCES news_posts(slug)
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

CREATE TABLE IF NOT EXISTS tournament_manager_assignments (
  id TEXT PRIMARY KEY,
  tournament_slug TEXT NOT NULL,
  manager_user_id TEXT NOT NULL,
  UNIQUE(tournament_slug, manager_user_id),
  FOREIGN KEY(tournament_slug) REFERENCES tournaments(slug),
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

CREATE TABLE IF NOT EXISTS gallery_social (
  image_key TEXT PRIMARY KEY,
  likes INTEGER NOT NULL DEFAULT 0,
  comments_json TEXT NOT NULL DEFAULT '[]',
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS gallery_albums (
  slug TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  sport TEXT NOT NULL,
  city TEXT NOT NULL,
  date_label TEXT NOT NULL,
  month_label TEXT NOT NULL,
  day_count INTEGER NOT NULL,
  cover TEXT NOT NULL,
  summary TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  published INTEGER NOT NULL DEFAULT 1
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

INDEX_SCHEMA = """
CREATE INDEX IF NOT EXISTS idx_tournaments_status ON tournaments(status);
CREATE INDEX IF NOT EXISTS idx_tournaments_sport ON tournaments(sport);
CREATE INDEX IF NOT EXISTS idx_tournaments_location ON tournaments(location);
CREATE INDEX IF NOT EXISTS idx_tournament_cities_slug ON tournament_cities(tournament_slug, sort_order);
CREATE INDEX IF NOT EXISTS idx_registrations_user ON registrations(user_id);
CREATE INDEX IF NOT EXISTS idx_registrations_email ON registrations(email);
CREATE INDEX IF NOT EXISTS idx_registrations_city_status ON registrations(city, status);
CREATE INDEX IF NOT EXISTS idx_registrations_tournament_status ON registrations(tournament_slug, status);
CREATE INDEX IF NOT EXISTS idx_registrations_tournament_team_name_lookup ON registrations(tournament_slug, lower(trim(team_name)));
CREATE INDEX IF NOT EXISTS idx_registration_members_reg ON registration_members(registration_id);
CREATE INDEX IF NOT EXISTS idx_registration_documents_reg ON registration_documents(registration_id);
CREATE INDEX IF NOT EXISTS idx_payments_registration ON payments(registration_id);
CREATE INDEX IF NOT EXISTS idx_news_status_dates ON news_posts(status, published_at, created_at);
CREATE INDEX IF NOT EXISTS idx_news_slug_status ON news_posts(slug, status);
CREATE INDEX IF NOT EXISTS idx_news_sport_city ON news_posts(sport, city);
CREATE INDEX IF NOT EXISTS idx_news_blocks_post_order ON news_blocks(post_slug, sort_order);
CREATE INDEX IF NOT EXISTS idx_sport_home_visibility_sort ON sport_home_visibility(show_on_home, sort_order);
CREATE INDEX IF NOT EXISTS idx_manager_city_user ON manager_city_assignments(manager_user_id, city);
CREATE INDEX IF NOT EXISTS idx_tournament_manager_user ON tournament_manager_assignments(manager_user_id, tournament_slug);
CREATE INDEX IF NOT EXISTS idx_gallery_social_updated ON gallery_social(updated_at);
CREATE INDEX IF NOT EXISTS idx_gallery_albums_month ON gallery_albums(month_label, sort_order);
CREATE INDEX IF NOT EXISTS idx_live_matches_status ON live_matches(status);
CREATE INDEX IF NOT EXISTS idx_timeline_match ON timeline_events(match_id, id);
CREATE INDEX IF NOT EXISTS idx_bracket_nodes_tournament ON bracket_nodes(tournament_slug, x, y);
CREATE INDEX IF NOT EXISTS idx_bracket_connections_tournament ON bracket_connections(tournament_slug);
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
        _executescript(conn, INDEX_SCHEMA)
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
        tournament_columns = {
            "min_team_size": "INTEGER NOT NULL DEFAULT 2",
            "max_team_size": "INTEGER NOT NULL DEFAULT 16",
            "address": "TEXT NOT NULL DEFAULT ''",
            "sport_description": "TEXT NOT NULL DEFAULT ''",
            "tournament_description": "TEXT NOT NULL DEFAULT ''",
            "fee_breakdown_json": "TEXT NOT NULL DEFAULT '[]'",
            "show_on_home": "INTEGER NOT NULL DEFAULT 1",
            "block_repeat_registration": "INTEGER NOT NULL DEFAULT 0",
        }
        for column, definition in tournament_columns.items():
            _add_column(conn, "tournaments", column, definition)
        user_columns = {
            "phone": "TEXT NOT NULL DEFAULT ''",
            "email_verified": "INTEGER NOT NULL DEFAULT 1",
            "phone_verified": "INTEGER NOT NULL DEFAULT 1",
            "google_login": "INTEGER NOT NULL DEFAULT 0",
            "google_sub": "TEXT NOT NULL DEFAULT ''",
            "avatar_url": "TEXT NOT NULL DEFAULT ''",
        }
        for column, definition in user_columns.items():
            _add_column(conn, "users", column, definition)
        _add_column(conn, "news_posts", "is_highlight", "INTEGER NOT NULL DEFAULT 0")
        _executescript(conn, """
CREATE TABLE IF NOT EXISTS home_discovery_cards (
  slug TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  title TEXT NOT NULL,
  sport TEXT NOT NULL,
  tournament_slug TEXT NOT NULL DEFAULT '',
  sponsor_name TEXT NOT NULL,
  sponsor_image TEXT NOT NULL,
  image TEXT NOT NULL,
  event_date TEXT NOT NULL,
  description TEXT NOT NULL,
  sponsor_details TEXT NOT NULL,
  register_path TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 1,
  published INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE IF NOT EXISTS live_highlights (
  id TEXT PRIMARY KEY,
  match_id TEXT NOT NULL DEFAULT '',
  title TEXT NOT NULL,
  stage_label TEXT NOT NULL,
  home_team TEXT NOT NULL,
  away_team TEXT NOT NULL,
  home_score TEXT NOT NULL,
  away_score TEXT NOT NULL,
  image TEXT NOT NULL,
  description TEXT NOT NULL,
  impact_notes TEXT NOT NULL,
  link_path TEXT NOT NULL DEFAULT '/live',
  sort_order INTEGER NOT NULL DEFAULT 1,
  published INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE IF NOT EXISTS sponsor_logos (
  slug TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  image TEXT NOT NULL,
  link_url TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 1,
  published INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE IF NOT EXISTS news_social (
  news_slug TEXT PRIMARY KEY,
  likes INTEGER NOT NULL DEFAULT 0,
  comments_json TEXT NOT NULL DEFAULT '[]',
  updated_at TEXT NOT NULL
);
""")
        live_match_columns = {
            "youtube_url": "TEXT NOT NULL DEFAULT ''",
            "venue": "TEXT NOT NULL DEFAULT ''",
            "match_clock": "TEXT NOT NULL DEFAULT ''",
            "current_players_json": "TEXT NOT NULL DEFAULT '[]'",
            "substitutes_json": "TEXT NOT NULL DEFAULT '[]'",
            "player_scores_json": "TEXT NOT NULL DEFAULT '[]'",
            "team_stats_json": "TEXT NOT NULL DEFAULT '{}'",
        }
        for column, definition in live_match_columns.items():
            _add_column(conn, "live_matches", column, definition)
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
