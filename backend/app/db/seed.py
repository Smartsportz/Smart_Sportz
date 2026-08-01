from __future__ import annotations

import json
from datetime import datetime, timezone
from uuid import uuid4

from app.core.security import hash_password
from app.db.database import audit_execute, execute, execute_many, row


def now() -> str:
    return datetime.now(timezone.utc).isoformat()


def prize_rows(tournament_slug: str, total_amount: int) -> list[tuple[str, tuple]]:
    prizes = [
        (1, "1st Prize", int(total_amount * 0.60), 1),
        (2, "2nd Prize", int(total_amount * 0.30), 2),
        (3, "3rd Prize", total_amount - int(total_amount * 0.60) - int(total_amount * 0.30), 3),
    ]
    return [
        (
            "INSERT OR IGNORE INTO tournament_prizes(id, tournament_slug, position, label, amount, sort_order) VALUES (?, ?, ?, ?, ?, ?)",
            (f"prize_{tournament_slug}_{position}", tournament_slug, position, label, amount, sort_order),
        )
        for position, label, amount, sort_order in prizes
    ]


def seed_gallery_album_metadata() -> None:
    statements = [
        (
            """
            INSERT OR IGNORE INTO gallery_albums (
              slug, title, sport, city, date_label, month_label, day_count, cover, summary, sort_order, published
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                "kerala-volleyball-classic",
                "Kerala Volleyball Classic 2025",
                "Volleyball",
                "Kochi",
                "Dec 02 - Dec 12, 2025",
                "Dec 2025",
                11,
                "/assets/volleyball-match.png",
                "Final day ceremony, winning rallies, team huddles, awards, and verified match media.",
                1,
                1,
            ),
        ),
        (
            """
            INSERT OR IGNORE INTO gallery_albums (
              slug, title, sport, city, date_label, month_label, day_count, cover, summary, sort_order, published
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                "delhi-cricket-champions",
                "Delhi Cricket Champions 2025",
                "Cricket",
                "Delhi",
                "Nov 05 - Nov 24, 2025",
                "Nov 2025",
                20,
                "/assets/cricket-stadium.png",
                "Completed cricket archive with innings photos, awards, team records, and verified player score moments.",
                2,
                1,
            ),
        ),
    ]
    execute_many(statements)


def live_detail_update_rows() -> list[tuple[str, tuple]]:
    return [
        (
            "UPDATE live_matches SET youtube_url = ?, venue = ?, match_clock = ?, current_players_json = ?, substitutes_json = ?, player_scores_json = ?, team_stats_json = ? WHERE id = ?",
            (
                "https://www.youtube.com/embed/ThqHtJOfCK0",
                "M. Chinnaswamy Stadium, Bengaluru",
                "18.4 overs",
                json.dumps([
                    {"team": "India Forge", "name": "Rohan Sharma", "role": "Striker", "status": "Batting", "score": "74 (42)"},
                    {"team": "India Forge", "name": "Nikhil Rao", "role": "Non-striker", "status": "Batting", "score": "39 (24)"},
                    {"team": "England XI", "name": "James Carter", "role": "Bowler", "status": "Bowling", "score": "2/28"},
                    {"team": "England XI", "name": "Owen Smith", "role": "Keeper", "status": "Fielding", "score": "1 catch"},
                ]),
                json.dumps([
                    {"team": "India Forge", "name": "Amit Verma", "role": "Impact batter"},
                    {"team": "India Forge", "name": "Karan Bedi", "role": "Seam option"},
                    {"team": "England XI", "name": "Liam Brooks", "role": "Death overs"},
                    {"team": "England XI", "name": "Noah Ellis", "role": "All-rounder"},
                ]),
                json.dumps([
                    {"team": "India Forge", "player": "Rohan Sharma", "score": "74 runs", "detail": "6 fours, 3 sixes", "impact": 94},
                    {"team": "India Forge", "player": "Nikhil Rao", "score": "39 runs", "detail": "Strike rate 162", "impact": 81},
                    {"team": "England XI", "player": "James Carter", "score": "2 wickets", "detail": "Economy 6.2", "impact": 88},
                    {"team": "England XI", "player": "Owen Smith", "score": "1 catch", "detail": "Deep square leg", "impact": 72},
                ]),
                json.dumps({
                    "home": {"possession": 62, "shots": "18 boundaries", "accuracy": "8.36 RR", "momentum": "High"},
                    "away": {"possession": 38, "shots": "4 wickets", "accuracy": "6.20 economy", "momentum": "Holding"},
                }),
                "match-48",
            ),
        ),
        (
            "UPDATE live_matches SET youtube_url = ?, venue = ?, match_clock = ?, current_players_json = ?, substitutes_json = ?, player_scores_json = ?, team_stats_json = ? WHERE id = ?",
            (
                "https://www.youtube.com/embed/ThqHtJOfCK0",
                "Jawaharlal Nehru Indoor Arena, Chennai",
                "Q3 08:39",
                json.dumps([
                    {"team": "Titans United", "name": "Marcus Lee", "role": "Point Guard", "status": "On court", "score": "18 pts"},
                    {"team": "Titans United", "name": "Dev Arora", "role": "Forward", "status": "On court", "score": "12 pts"},
                    {"team": "Phoenix Fire", "name": "Ryan Cole", "role": "Shooting Guard", "status": "On court", "score": "21 pts"},
                    {"team": "Phoenix Fire", "name": "Arun Das", "role": "Center", "status": "On court", "score": "9 reb"},
                ]),
                json.dumps([
                    {"team": "Titans United", "name": "Harish Menon", "role": "Guard rotation"},
                    {"team": "Phoenix Fire", "name": "Neil Thomas", "role": "Defensive wing"},
                ]),
                json.dumps([
                    {"team": "Titans United", "player": "Marcus Lee", "score": "18 pts", "detail": "5 ast, 2 stl", "impact": 86},
                    {"team": "Phoenix Fire", "player": "Ryan Cole", "score": "21 pts", "detail": "4/7 from three", "impact": 91},
                ]),
                json.dumps({
                    "home": {"possession": 48, "shots": "41 FG attempts", "accuracy": "47% FG", "momentum": "Chasing"},
                    "away": {"possession": 52, "shots": "39 FG attempts", "accuracy": "51% FG", "momentum": "Control"},
                }),
                "match-72",
            ),
        ),
        (
            "UPDATE live_matches SET youtube_url = ?, venue = ?, match_clock = ?, current_players_json = ?, substitutes_json = ?, player_scores_json = ?, team_stats_json = ? WHERE id = ?",
            (
                "https://www.youtube.com/embed/ThqHtJOfCK0",
                "Delhi Youth Sports Complex",
                "78 min",
                json.dumps([
                    {"team": "Bengaluru Bulls", "name": "Aditya Rao", "role": "Forward", "status": "Attacking", "score": "1 goal"},
                    {"team": "Bengaluru Bulls", "name": "Manu Iyer", "role": "Midfield", "status": "On pitch", "score": "1 assist"},
                    {"team": "Mumbai Mavericks", "name": "Kabir Shah", "role": "Forward", "status": "Pressing", "score": "1 goal"},
                    {"team": "Mumbai Mavericks", "name": "Rohit Sen", "role": "Goalkeeper", "status": "On pitch", "score": "4 saves"},
                ]),
                json.dumps([
                    {"team": "Bengaluru Bulls", "name": "Sahil Khan", "role": "Fresh legs"},
                    {"team": "Mumbai Mavericks", "name": "Vivaan Mehta", "role": "Late attack"},
                ]),
                json.dumps([
                    {"team": "Bengaluru Bulls", "player": "Aditya Rao", "score": "1 goal", "detail": "3 shots on target", "impact": 84},
                    {"team": "Mumbai Mavericks", "player": "Rohit Sen", "score": "4 saves", "detail": "Penalty stop", "impact": 89},
                ]),
                json.dumps({
                    "home": {"possession": 54, "shots": "12 shots", "accuracy": "6 on target", "momentum": "Pressing"},
                    "away": {"possession": 46, "shots": "9 shots", "accuracy": "4 on target", "momentum": "Counter"},
                }),
                "match-21",
            ),
        ),
    ]


def seed_live_match_details() -> None:
    if row("SELECT id FROM live_matches LIMIT 1"):
        execute_many(live_detail_update_rows())


def seed_data() -> None:
    if row("SELECT id FROM users LIMIT 1"):
        return

    users = [
        (str(uuid4()), "admin@smartsportz.in", "Smart Sportz Admin", "super_admin", hash_password("admin123"), "", 1, 1, now()),
        (str(uuid4()), "manager@smartsportz.in", "Tournament Manager", "management", hash_password("manager123"), "", 1, 1, now()),
        (str(uuid4()), "user@smartsportz.in", "Aryan Player", "user", hash_password("user123"), "+916374409006", 1, 1, now()),
    ]
    sports = [
        ("cricket", "Cricket", 42, "emerald"),
        ("football", "Football", 36, "blue"),
        ("basketball", "Basketball", 18, "orange"),
        ("volleyball", "Volleyball", 16, "pink"),
        ("badminton", "Badminton", 22, "emerald"),
        ("table-tennis", "Table Tennis", 11, "blue"),
        ("e-sports", "E-Sports", 29, "orange"),
        ("athletics", "Athletics", 14, "emerald"),
    ]
    tournaments = [
        ("mumbai-premier-bash", "Mumbai Premier Bash 2026", "Cricket", "Registration Open", "Mumbai", "Aug 14 - Sep 02", "Jul 24, 2026", "Aug 10, 2026", 32, 48, 16, "INR 25,00,000", "/assets/cricket-stadium.png", "emerald"),
        ("bangalore-corporate-t20", "Bangalore Corporate T20", "Cricket", "Live", "Bengaluru", "Jul 25 - Aug 05", "Jul 01, 2026", "Jul 20, 2026", 18, 24, 16, "INR 12,00,000", "/assets/cricket-stadium.png", "orange"),
        ("national-youth-football", "National Youth Football Cup", "Football", "Upcoming", "Delhi", "Sep 12 - Sep 20", "Aug 01, 2026", "Sep 05, 2026", 24, 32, 22, "INR 8,50,000", "/assets/football-match.png", "blue"),
        ("pro-elite-basketball", "Pro Elite Basketball Series", "Basketball", "Registration Open", "Chennai", "Oct 04 - Oct 12", "Jul 24, 2026", "Sep 25, 2026", 16, 16, 12, "INR 10,00,000", "/assets/basketball-match.png", "emerald"),
    ]
    teams = [
        ("mumbai-mavericks", "Mumbai Mavericks", "#01", "Cricket", 18, 15, 92, "/assets/cricket-stadium.png"),
        ("bangalore-blaze", "Bangalore Blaze", "#04", "Football", 22, 12, 88, "/assets/football-match.png"),
        ("chennai-chargers", "Chennai Chargers", "#12", "Basketball", 15, 9, 81, "/assets/basketball-match.png"),
        ("kerala-spikers", "Kerala Spikers", "#07", "Volleyball", 12, 10, 86, "/assets/volleyball-match.png"),
    ]
    matches = [
        ("match-48", "Bangalore Corporate T20", "Cricket", "India Forge", "England XI", "156/4", "Yet to bat", "Over 18.4", "Live Now", "/assets/cricket-stadium.png"),
        ("match-72", "Pro Elite Basketball Series", "Basketball", "Titans United", "Phoenix Fire", "58", "62", "Q3 08:39", "Live Now", "/assets/basketball-match.png"),
        ("match-21", "Youth Football Cup", "Football", "Bengaluru Bulls", "Mumbai Mavericks", "2", "1", "78 min", "Second Half", "/assets/football-match.png"),
    ]
    timeline = [
        ("match-48", "18.4", "FOUR", "Rohan Sharma drives through extra cover. The chasing side tightens control.", "156/4", now()),
        ("match-48", "17.6", "WICKET", "Clean catch at deep square leg after a slower ball variation.", "148/4", now()),
        ("match-48", "16.2", "SIX", "Massive hit over long-on. Crowd volume spikes in the live feed.", "139/3", now()),
        ("match-48", "15.1", "COMMENTARY", "Bowling team changes field to protect the off-side boundary.", "126/3", now()),
    ]
    cms = [
        ("ai-sports-analytics", "The Future of AI in Professional Sports Analytics", "Article", "Smart Sportz can support match intelligence, reports, and live insights after the core backend is stable.", "/blog/ai-sports-analytics", 1),
        ("regional-masters-highlights", "Regional Masters Photo Highlights", "Gallery", "Public gallery content managed through the CMS module.", "/gallery", 1),
        ("payment-refund-guide", "Tournament Payment and Refund Guide", "FAQ", "Local payment flow now; external Razorpay can be connected later.", "/faq", 1),
    ]

    statements: list[tuple[str, tuple]] = []
    statements += [(
        """
        INSERT INTO users (
          id, email, name, role, password_hash, phone, email_verified, phone_verified, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        item,
    ) for item in users]
    statements += [("INSERT INTO sports VALUES (?, ?, ?, ?)", item) for item in sports]
    statements += [(
        """
        INSERT INTO tournaments (
          slug, name, sport, status, location, date, registration_start, registration_end,
          teams, capacity, team_size, prize, image, accent
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        item,
    ) for item in tournaments]
    statements += prize_rows("mumbai-premier-bash", 250000000)
    statements += prize_rows("bangalore-corporate-t20", 120000000)
    statements += prize_rows("national-youth-football", 85000000)
    statements += prize_rows("pro-elite-basketball", 100000000)
    statements += [("INSERT INTO teams VALUES (?, ?, ?, ?, ?, ?, ?, ?)", item) for item in teams]
    statements += [(
        """
        INSERT INTO live_matches (
          id, tournament, sport, home, away, score, away_score, stage, status, image
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        item,
    ) for item in matches]
    statements += [("INSERT INTO timeline_events(match_id, time, type, text, score, created_at) VALUES (?, ?, ?, ?, ?, ?)", item) for item in timeline]
    statements += [("INSERT INTO cms_content VALUES (?, ?, ?, ?, ?, ?)", item) for item in cms]
    execute_many(statements)
    audit_execute(
        "INSERT INTO audit_logs(actor, action, entity, entity_id, message, created_at) VALUES (?, ?, ?, ?, ?, ?)",
        ("system", "seed", "database", "local", "Initial local database seeded", now()),
    )


def seed_operational_data() -> None:
    operational_ready = (
        row("SELECT slug FROM tournaments WHERE slug = ?", ("kerala-volleyball-classic",))
        and row("SELECT slug FROM news_posts LIMIT 1")
        and row("SELECT id FROM leaderboard_records LIMIT 1")
        and row("SELECT id FROM tournament_prizes LIMIT 1")
    )
    seed_live_match_details()
    seed_gallery_album_metadata()
    if operational_ready:
        return
    statements: list[tuple[str, tuple]] = []
    execute("UPDATE tournaments SET team_size = 16 WHERE slug IN ('mumbai-premier-bash', 'bangalore-corporate-t20', 'delhi-cricket-champions')")
    execute("UPDATE tournaments SET team_size = 22 WHERE slug = 'national-youth-football'")
    execute("UPDATE tournaments SET team_size = 12 WHERE slug IN ('pro-elite-basketball', 'kerala-volleyball-classic')")
    execute("UPDATE tournaments SET registration_start = 'Jul 24, 2026', registration_end = 'Aug 10, 2026' WHERE slug = 'mumbai-premier-bash'")
    execute("UPDATE tournaments SET registration_start = 'Jul 01, 2026', registration_end = 'Jul 20, 2026' WHERE slug = 'bangalore-corporate-t20'")
    execute("UPDATE tournaments SET registration_start = 'Aug 01, 2026', registration_end = 'Sep 05, 2026' WHERE slug = 'national-youth-football'")
    execute("UPDATE tournaments SET registration_start = 'Jul 24, 2026', registration_end = 'Sep 25, 2026' WHERE slug = 'pro-elite-basketball'")
    statements += live_detail_update_rows()
    execute("UPDATE registrations SET city = 'Bengaluru' WHERE id IN ('reg-101', 'reg-103') AND city = ''")
    execute("UPDATE registrations SET city = 'Mysuru' WHERE id = 'reg-102' AND city = ''")
    if not row("SELECT slug FROM tournaments WHERE slug = ?", ("kerala-volleyball-classic",)):
        statements.append((
            """
            INSERT INTO tournaments (
              slug, name, sport, status, location, date, registration_start, registration_end,
              teams, capacity, team_size, prize, image, accent
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            ("kerala-volleyball-classic", "Kerala Volleyball Classic 2025", "Volleyball", "Completed", "Kochi", "Dec 02 - Dec 12", "Oct 15, 2025", "Nov 25, 2025", 20, 20, 12, "INR 6,00,000", "/assets/volleyball-match.png", "pink"),
        ))
        statements += prize_rows("kerala-volleyball-classic", 60000000)
    if not row("SELECT slug FROM tournaments WHERE slug = ?", ("delhi-cricket-champions",)):
        statements.append((
            """
            INSERT INTO tournaments (
              slug, name, sport, status, location, date, registration_start, registration_end,
              teams, capacity, team_size, prize, image, accent
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            ("delhi-cricket-champions", "Delhi Cricket Champions 2025", "Cricket", "Completed", "Delhi", "Nov 05 - Nov 24", "Sep 20, 2025", "Oct 25, 2025", 20, 20, 16, "INR 15,00,000", "/assets/cricket-stadium.png", "blue"),
        ))
        statements += prize_rows("delhi-cricket-champions", 150000000)
    for tournament_slug, total_amount in [
        ("mumbai-premier-bash", 250000000),
        ("bangalore-corporate-t20", 120000000),
        ("national-youth-football", 85000000),
        ("pro-elite-basketball", 100000000),
    ]:
        if not row("SELECT id FROM tournament_prizes WHERE tournament_slug = ? LIMIT 1", (tournament_slug,)):
            statements += prize_rows(tournament_slug, total_amount)
    city_map = {
        "mumbai-premier-bash": ["Mumbai", "Navi Mumbai", "Thane"],
        "bangalore-corporate-t20": ["Bengaluru", "Mysuru"],
        "national-youth-football": ["Delhi", "Noida", "Gurugram"],
        "pro-elite-basketball": ["Chennai", "Coimbatore", "Madurai"],
        "kerala-volleyball-classic": ["Kochi", "Kozhikode", "Thiruvananthapuram"],
        "delhi-cricket-champions": ["Delhi", "Faridabad"],
    }
    for tournament_slug, cities in city_map.items():
        existing = row("SELECT id FROM tournament_cities WHERE tournament_slug = ? LIMIT 1", (tournament_slug,))
        if not existing:
            for sort_order, city in enumerate(cities, start=1):
                statements.append((
                    "INSERT OR IGNORE INTO tournament_cities(id, tournament_slug, city, sort_order) VALUES (?, ?, ?, ?)",
                    (f"city_{uuid4().hex[:10]}", tournament_slug, city, sort_order),
                ))
    if not row("SELECT id FROM registrations WHERE id = ?", ("reg-101",)):
        registrations = [
            ("reg-101", "bangalore-corporate-t20", "Falcon Strikers", "Rahul Nair", "rahul@falcon.local", "+91 90000 00101", "Bengaluru", "pending_approval", "paid", 250000, now()),
            ("reg-102", "bangalore-corporate-t20", "Kochi Kings", "Sanjay Menon", "sanjay@kochi.local", "+91 90000 00102", "Mysuru", "accepted", "paid", 250000, now()),
            ("reg-103", "bangalore-corporate-t20", "Hyderabad Royals", "Imran Khan", "imran@royals.local", "+91 90000 00103", "Bengaluru", "pending_payment", "pending", 250000, now()),
        ]
        statements += [(
            """
            INSERT INTO registrations (
              id, tournament_slug, team_name, captain_name, email, phone, city,
              status, payment_status, amount, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            item,
        ) for item in registrations]
    default_bracket_count = row("SELECT COUNT(*) AS total FROM bracket_nodes WHERE tournament_slug = ?", ("bangalore-corporate-t20",))
    if default_bracket_count and int(default_bracket_count["total"]) != 19:
        execute("DELETE FROM bracket_connections WHERE tournament_slug = ?", ("bangalore-corporate-t20",))
        execute("DELETE FROM bracket_nodes WHERE tournament_slug = ?", ("bangalore-corporate-t20",))
    if not row("SELECT id FROM bracket_nodes WHERE tournament_slug = ?", ("bangalore-corporate-t20",)):
        nodes = [
            ("r1a", "bangalore-corporate-t20", "Seed 1", "Mumbai Mavericks", "Round-1", 7, 16, "paired"),
            ("r1b", "bangalore-corporate-t20", "Seed 2", "India Forge", "Round-1", 7, 28, "winner"),
            ("r1c", "bangalore-corporate-t20", "Seed 3", "Bengaluru Bulls", "Round-1", 7, 43, "paired"),
            ("r1d", "bangalore-corporate-t20", "Seed 4", "Chennai Chargers", "Round-1", 7, 55, "paired"),
            ("r1e", "bangalore-corporate-t20", "Seed 5", "Kerala Spikers", "Round-1", 7, 70, "paired"),
            ("r1f", "bangalore-corporate-t20", "Seed 6", "Falcon Strikers", "Round-1", 7, 82, "paired"),
            ("q1a", "bangalore-corporate-t20", "Q1-A", "India Forge", "Quarter", 30, 18, "winner"),
            ("q1b", "bangalore-corporate-t20", "Q1-B", "Hyderabad Royals", "Quarter", 30, 30, "paired"),
            ("q2a", "bangalore-corporate-t20", "Q2-A", "", "Quarter", 30, 45, "empty"),
            ("q2b", "bangalore-corporate-t20", "Q2-B", "Kochi Kings", "Quarter", 30, 57, "paired"),
            ("q3a", "bangalore-corporate-t20", "Q3-A", "", "Quarter", 30, 72, "empty"),
            ("q3b", "bangalore-corporate-t20", "Q3-B", "", "Quarter", 30, 84, "empty"),
            ("s1a", "bangalore-corporate-t20", "S1-A", "India Forge", "Semi-Final", 55, 29, "winner"),
            ("s1b", "bangalore-corporate-t20", "S1-B", "", "Semi-Final", 55, 45, "empty"),
            ("s2a", "bangalore-corporate-t20", "S2-A", "", "Semi-Final", 55, 64, "empty"),
            ("s2b", "bangalore-corporate-t20", "S2-B", "", "Semi-Final", 55, 80, "empty"),
            ("f1a", "bangalore-corporate-t20", "Final-A", "India Forge", "Final", 78, 43, "winner"),
            ("f1b", "bangalore-corporate-t20", "Final-B", "", "Final", 78, 65, "empty"),
            ("champ", "bangalore-corporate-t20", "Champion", "", "Champion", 94, 55, "empty"),
        ]
        connections = [
            ("c1", "bangalore-corporate-t20", "r1a", "q1a"),
            ("c2", "bangalore-corporate-t20", "r1b", "q1a"),
            ("c3", "bangalore-corporate-t20", "r1c", "q2a"),
            ("c4", "bangalore-corporate-t20", "r1d", "q2a"),
            ("c5", "bangalore-corporate-t20", "r1e", "q3a"),
            ("c6", "bangalore-corporate-t20", "r1f", "q3a"),
            ("c7", "bangalore-corporate-t20", "q1a", "s1a"),
            ("c8", "bangalore-corporate-t20", "q1b", "s1a"),
            ("c9", "bangalore-corporate-t20", "q2a", "s1b"),
            ("c10", "bangalore-corporate-t20", "q2b", "s1b"),
            ("c11", "bangalore-corporate-t20", "q3a", "s2a"),
            ("c12", "bangalore-corporate-t20", "q3b", "s2a"),
            ("c13", "bangalore-corporate-t20", "s1a", "f1a"),
            ("c14", "bangalore-corporate-t20", "s1b", "f1a"),
            ("c15", "bangalore-corporate-t20", "s2a", "f1b"),
            ("c16", "bangalore-corporate-t20", "s2b", "f1b"),
            ("c17", "bangalore-corporate-t20", "f1a", "champ"),
            ("c18", "bangalore-corporate-t20", "f1b", "champ"),
        ]
        statements += [("INSERT INTO bracket_nodes VALUES (?, ?, ?, ?, ?, ?, ?, ?)", item) for item in nodes]
        statements += [("INSERT INTO bracket_connections VALUES (?, ?, ?, ?)", item) for item in connections]
    manager = row("SELECT id FROM users WHERE email = ?", ("manager@smartsportz.in",))
    if manager and not row("SELECT id FROM manager_city_assignments WHERE manager_user_id = ? LIMIT 1", (manager["id"],)):
        for city in ["Bengaluru", "Mysuru", "Mumbai"]:
            statements.append((
                "INSERT OR IGNORE INTO manager_city_assignments(id, manager_user_id, city) VALUES (?, ?, ?)",
                (f"mcity_{uuid4().hex[:10]}", manager["id"], city),
            ))
    if not row("SELECT sport_slug FROM sport_home_visibility LIMIT 1"):
        visibility = [
            ("cricket", 1, 1),
            ("football", 1, 2),
            ("basketball", 1, 3),
            ("volleyball", 0, 4),
            ("badminton", 0, 5),
            ("table-tennis", 0, 6),
            ("e-sports", 0, 7),
            ("athletics", 0, 8),
        ]
        for sport_slug, show_on_home, sort_order in visibility:
            statements.append((
                "INSERT OR IGNORE INTO sport_home_visibility(sport_slug, show_on_home, sort_order, updated_by) VALUES (?, ?, ?, ?)",
                (sport_slug, show_on_home, sort_order, manager["id"] if manager else None),
            ))
    if not row("SELECT slug FROM news_posts LIMIT 1"):
        published = now()
        news_posts = [
            ("mumbai-mavericks-lift-premier-bash", "Mumbai Mavericks Lift Premier Bash Trophy", "Winner team ceremony, MVP moments, and final over highlights from Mumbai Premier Bash.", "/assets/cricket-stadium.png", "Winner Teams", "Cricket", "mumbai-premier-bash", "Mumbai", "published", 1, manager["id"] if manager else None, published, published, published),
            ("corporate-t20-live-score-surge", "Corporate T20 Live Score Surge", "India Forge take control with a late batting burst and updated live match records.", "/assets/cricket-stadium.png", "Match Updates", "Cricket", "bangalore-corporate-t20", "Bengaluru", "published", 1, manager["id"] if manager else None, published, published, published),
            ("football-cup-registration-opens-delhi", "Youth Football Cup Registration Window Opens", "Delhi, Noida, and Gurugram teams can prepare rosters before the official deadline.", "/assets/football-match.png", "Tournament Updates", "Football", "national-youth-football", "Delhi", "published", 0, manager["id"] if manager else None, published, published, published),
            ("kerala-volleyball-classic-archive", "Kerala Volleyball Classic Archived Records", "Completed match reports, player scorecards, and winner records are now available.", "/assets/volleyball-match.png", "Winner Teams", "Volleyball", "kerala-volleyball-classic", "Kochi", "published", 0, manager["id"] if manager else None, published, published, published),
        ]
        statements += [(
            """
            INSERT INTO news_posts (
              slug, title, short_description, image, category, sport, tournament_slug,
              city, status, is_highlight, author_id, published_at, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            item,
        ) for item in news_posts]
        news_blocks = {
            "mumbai-mavericks-lift-premier-bash": [
                ("heading", "Championship final recap"),
                ("paragraph", "Mumbai Mavericks controlled the final phase with disciplined bowling, clean fielding, and a decisive captaincy call in the last over."),
                ("quote", "The squad stayed calm under pressure and trusted the tournament plan."),
            ],
            "corporate-t20-live-score-surge": [
                ("heading", "Live match intelligence"),
                ("paragraph", "The match center recorded batting momentum, score history, and team-wise individual performance updates throughout the innings."),
                ("list", "Live score sync|Timeline commentary|Team records|Player highlights"),
            ],
            "football-cup-registration-opens-delhi": [
                ("heading", "Registration guidance"),
                ("paragraph", "Team captains should confirm city eligibility, roster size, documents, and registration payment before submission."),
                ("bold", "Only configured tournament cities are available in the registration form."),
            ],
            "kerala-volleyball-classic-archive": [
                ("heading", "Completed tournament archive"),
                ("paragraph", "Archived rounds, scorecards, final result, and downloadable records remain available for teams and spectators."),
                ("image", "/assets/volleyball-match.png"),
            ],
        }
        for post_slug, blocks in news_blocks.items():
            for sort_order, (block_type, content) in enumerate(blocks, start=1):
                statements.append((
                    "INSERT INTO news_blocks(id, post_slug, block_type, content_json, sort_order) VALUES (?, ?, ?, ?, ?)",
                    (f"nblock_{uuid4().hex[:10]}", post_slug, block_type, json.dumps({"text": content}), sort_order),
                ))
    if not row("SELECT id FROM leaderboard_records LIMIT 1"):
        leaderboard = [
            ("Cricket", "Mumbai Mavericks", "Mumbai", 1, 12, 88, 4820, "15 wins / 2 finals"),
            ("Cricket", "India Forge", "Bengaluru", 2, 9, 84, 4510, "11 wins / live finalist"),
            ("Cricket", "Kochi Kings", "Mysuru", 3, 7, 76, 3920, "Accepted playoff seed"),
            ("Football", "Bengaluru Bulls", "Delhi", 1, 8, 82, 4140, "18 goals / 5 clean sheets"),
            ("Football", "Delhi Strikers", "Delhi", 2, 6, 74, 3660, "Youth cup qualifier"),
            ("Basketball", "Chennai Chargers", "Chennai", 1, 6, 79, 3710, "Pro Elite top seed"),
            ("Volleyball", "Kerala Spikers", "Kochi", 1, 10, 86, 3980, "Classic champions"),
            ("Badminton", "Metro Smashers", "Mumbai", 1, 5, 72, 3210, "Mixed doubles leaders"),
            ("Table Tennis", "Spin Masters", "Bengaluru", 1, 4, 70, 3025, "Rapid rally record"),
            ("E-Sports", "Pixel Titans", "Bengaluru", 1, 11, 90, 5060, "LAN cup champions"),
            ("Athletics", "Track Hawks", "Delhi", 1, 7, 81, 4115, "Relay record holders"),
        ]
        for sport, team_name, city, rank, tournaments_won, win_rate, points, record_label in leaderboard:
            statements.append((
                "INSERT INTO leaderboard_records(id, sport, team_name, city, rank, tournaments_won, win_rate, points, record_label) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
                (f"leader_{uuid4().hex[:10]}", sport, team_name, city, rank, tournaments_won, win_rate, points, record_label),
            ))
    if statements:
        execute_many(statements)
        audit_execute(
            "INSERT INTO audit_logs(actor, action, entity, entity_id, message, created_at) VALUES (?, ?, ?, ?, ?, ?)",
            ("system", "seed_upgrade", "database", "local", "Operational bracket and registration data seeded", now()),
        )
