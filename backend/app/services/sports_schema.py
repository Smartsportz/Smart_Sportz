from __future__ import annotations

import json
from datetime import datetime, timezone

from app.db.database import connect, ensure_column, execute, row

_sport_columns_ready = False
_chess_content_ready = False
_chess_school_tables_ready = False


def ensure_sport_content_columns() -> None:
    global _sport_columns_ready
    if _sport_columns_ready:
        return
    columns = {
        "title": "TEXT NOT NULL DEFAULT ''",
        "image": "TEXT NOT NULL DEFAULT ''",
        "description": "TEXT NOT NULL DEFAULT ''",
        "operations": "TEXT NOT NULL DEFAULT ''",
        "attribute_json": "TEXT NOT NULL DEFAULT '[]'",
        "explore_label": "TEXT NOT NULL DEFAULT ''",
        "explore_url": "TEXT NOT NULL DEFAULT ''",
        "sort_order": "INTEGER NOT NULL DEFAULT 99",
        "published": "INTEGER NOT NULL DEFAULT 1",
        "created_by": "TEXT NOT NULL DEFAULT ''",
        "created_at": "TEXT NOT NULL DEFAULT ''",
        "updated_at": "TEXT NOT NULL DEFAULT ''",
    }
    for column, definition in columns.items():
        ensure_column("sports", column, definition)
    _sport_columns_ready = True


def ensure_chess_sport_content() -> None:
    global _chess_content_ready
    if _chess_content_ready:
        return
    ensure_sport_content_columns()
    now = datetime.now(timezone.utc).isoformat()
    attributes = json.dumps([
        {"label": "Season", "value": "Winter 2026 planning window"},
        {"label": "Sponsor", "value": "Mind Sports Development Desk"},
        {"label": "Contact", "value": "City academy coordinators and school tournament committees"},
    ])
    if not row("SELECT slug FROM sports WHERE slug = ?", ("chess",)):
        execute(
            """INSERT INTO sports(
                 slug, name, active, color, title, image, description, operations, attribute_json,
                 explore_label, explore_url, sort_order, published, created_by, created_at, updated_at
               ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                "chess",
                "Chess",
                9,
                "emerald",
                "Chess Championship Operations",
                "/assets/generated/sport-chess-sponsor.png",
                "Chess events in Smart Sportz can be managed as school meets, academy leagues, open city championships, or corporate mind-sport festivals. The platform structure supports player identity, category selection, round allocation, result entry, certificates, and public ranking records.",
                "Organizers can publish tournament rules, sponsor notes, venue details, round timing, arbiters, participant instructions, and final standings in one structured page.",
                attributes,
                "Explore",
                "/sports/chess/schools",
                1,
                1,
                "system",
                now,
                now,
            ),
        )
    else:
        execute(
            """UPDATE sports
               SET title = CASE WHEN COALESCE(title, '') = '' THEN ? ELSE title END,
                   image = CASE WHEN COALESCE(image, '') = '' THEN ? ELSE image END,
                   description = CASE WHEN COALESCE(description, '') = '' THEN ? ELSE description END,
                   operations = CASE WHEN COALESCE(operations, '') = '' THEN ? ELSE operations END,
                   attribute_json = CASE WHEN COALESCE(attribute_json, '') IN ('', '[]') THEN ? ELSE attribute_json END,
                   explore_label = CASE WHEN COALESCE(explore_label, '') = '' THEN ? ELSE explore_label END,
                   explore_url = CASE WHEN COALESCE(explore_url, '') = '' THEN ? ELSE explore_url END,
                   sort_order = CASE WHEN COALESCE(sort_order, 99) = 99 THEN 1 ELSE sort_order END,
                   published = COALESCE(published, 1),
                   updated_at = CASE WHEN COALESCE(updated_at, '') = '' THEN ? ELSE updated_at END
               WHERE slug = ?""",
            (
                "Chess Championship Operations",
                "/assets/generated/sport-chess-sponsor.png",
                "Chess events in Smart Sportz can be managed as school meets, academy leagues, open city championships, or corporate mind-sport festivals. The platform structure supports player identity, category selection, round allocation, result entry, certificates, and public ranking records.",
                "Organizers can publish tournament rules, sponsor notes, venue details, round timing, arbiters, participant instructions, and final standings in one structured page.",
                attributes,
                "Explore",
                "/sports/chess/schools",
                now,
                "chess",
            ),
        )
    _chess_content_ready = True


def ensure_chess_school_tables() -> None:
    global _chess_school_tables_ready
    if _chess_school_tables_ready:
        return
    with connect() as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS chess_schools (
              slug TEXT PRIMARY KEY,
              name TEXT NOT NULL,
              city TEXT NOT NULL DEFAULT '',
              coordinator TEXT NOT NULL DEFAULT '',
              summary TEXT NOT NULL DEFAULT '',
              published INTEGER NOT NULL DEFAULT 1,
              sort_order INTEGER NOT NULL DEFAULT 1,
              created_at TEXT NOT NULL DEFAULT '',
              updated_at TEXT NOT NULL DEFAULT ''
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS chess_school_students (
              id TEXT PRIMARY KEY,
              school_slug TEXT NOT NULL,
              name TEXT NOT NULL,
              grade TEXT NOT NULL DEFAULT '',
              rank INTEGER NOT NULL DEFAULT 1,
              strength TEXT NOT NULL DEFAULT '',
              note TEXT NOT NULL DEFAULT '',
              avatar_image TEXT NOT NULL DEFAULT '',
              published INTEGER NOT NULL DEFAULT 1,
              created_at TEXT NOT NULL DEFAULT '',
              updated_at TEXT NOT NULL DEFAULT '',
              FOREIGN KEY(school_slug) REFERENCES chess_schools(slug)
            )
            """
        )
        conn.execute("CREATE INDEX IF NOT EXISTS idx_chess_schools_published_sort ON chess_schools(published, sort_order)")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_chess_students_school_rank ON chess_school_students(school_slug, rank)")
        conn.commit()
    _chess_school_tables_ready = True
