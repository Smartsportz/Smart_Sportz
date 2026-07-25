from __future__ import annotations

import json

from fastapi import APIRouter, HTTPException, Query

from app.core.responses import ok
from app.db.database import row, rows

router = APIRouter(tags=["content"])


def attach_news_blocks(post: dict) -> dict:
    blocks = rows(
        "SELECT block_type, content_json, sort_order FROM news_blocks WHERE post_slug = ? ORDER BY sort_order",
        (post["slug"],),
    )
    post["blocks"] = [
        {
            "type": block["block_type"],
            "content": json.loads(block["content_json"]).get("text", ""),
            "sortOrder": block["sort_order"],
        }
        for block in blocks
    ]
    return post


@router.get("/news")
def news():
    return ok([
        attach_news_blocks(item)
        for item in rows("SELECT * FROM news_posts WHERE status = 'published' ORDER BY published_at DESC, created_at DESC")
    ])


@router.get("/news/{slug}")
def news_detail(slug: str):
    post = row("SELECT * FROM news_posts WHERE slug = ? AND status = 'published'", (slug,))
    if not post:
        raise HTTPException(status_code=404, detail="News post not found")
    related = rows(
        """SELECT slug, title, image, category, short_description
           FROM news_posts
           WHERE status = 'published' AND slug != ? AND (sport = ? OR city = ?)
           ORDER BY published_at DESC LIMIT 3""",
        (slug, post["sport"], post["city"]),
    )
    post = attach_news_blocks(post)
    post["related"] = related
    return ok(post)


@router.get("/home/sports")
def home_sports():
    data = []
    for sport in rows(
        """SELECT s.slug, s.name, s.active, s.color, COALESCE(v.show_on_home, 0) AS show_on_home,
                  COALESCE(v.sort_order, 99) AS sort_order
           FROM sports s
           LEFT JOIN sport_home_visibility v ON v.sport_slug = s.slug
           WHERE COALESCE(v.show_on_home, 0) = 1
           ORDER BY COALESCE(v.sort_order, 99), s.name"""
    ):
        counts = row(
            """SELECT
                 SUM(CASE WHEN status IN ('Registration Open', 'Upcoming') THEN 1 ELSE 0 END) AS upcoming,
                 SUM(CASE WHEN status = 'Live' THEN 1 ELSE 0 END) AS live,
                 SUM(CASE WHEN status = 'Completed' THEN 1 ELSE 0 END) AS old
               FROM tournaments WHERE lower(sport) = lower(?)""",
            (sport["name"],),
        )
        sport["counts"] = {
            "upcoming": counts["upcoming"] or 0,
            "live": counts["live"] or 0,
            "old": counts["old"] or 0,
        }
        data.append(sport)
    return ok(data)


@router.get("/leaderboards")
def leaderboards(sport: str = Query(default="Cricket")):
    records = rows(
        """SELECT sport, team_name, city, rank, tournaments_won, win_rate, points, record_label
           FROM leaderboard_records
           WHERE lower(sport) = lower(?)
           ORDER BY rank ASC, points DESC""",
        (sport,),
    )
    return ok(records)
