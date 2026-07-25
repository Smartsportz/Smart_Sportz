from __future__ import annotations


ROLE_LABELS = {
    "super_admin": "Super Admin",
    "management": "Management User",
    "user": "Team / Participant",
}

ROLE_HOME = {
    "super_admin": "/admin/dashboard",
    "management": "/management/dashboard",
    "user": "/user/dashboard",
}

ROLE_PERMISSIONS = {
    "super_admin": [
        "tournaments.manage",
        "users.manage",
        "roles.manage",
        "payments.manage",
        "cms.manage",
        "reports.view",
        "logs.view",
        "settings.manage",
        "registrations.approve",
        "live_score.control",
    ],
    "management": [
        "assigned_tournaments.view",
        "registrations.review",
        "players.manage",
        "matches.control",
        "live_score.control",
        "announcements.manage",
        "reports.view_assigned",
    ],
    "user": [
        "profile.manage",
        "registrations.view_own",
        "payments.view_own",
        "receipts.download",
        "certificates.download",
        "schedules.view_own",
        "documents.view_own",
    ],
}

ROLE_PROGRAMS = {
    "super_admin": [
        {"label": "Dashboard", "path": "/admin/dashboard", "permission": "reports.view"},
        {"label": "Tournaments", "path": "/admin/tournaments", "permission": "tournaments.manage"},
        {"label": "Users and Roles", "path": "/admin/users", "permission": "users.manage"},
        {"label": "Payments", "path": "/admin/payments", "permission": "payments.manage"},
        {"label": "CMS", "path": "/admin/cms", "permission": "cms.manage"},
        {"label": "Reports", "path": "/admin/reports", "permission": "reports.view"},
        {"label": "Logs", "path": "/admin/logs", "permission": "logs.view"},
        {"label": "Settings", "path": "/settings", "permission": "settings.manage"},
    ],
    "management": [
        {"label": "Dashboard", "path": "/management/dashboard", "permission": "assigned_tournaments.view"},
        {"label": "Assigned Tournaments", "path": "/management/tournaments", "permission": "assigned_tournaments.view"},
        {"label": "Registrations", "path": "/management/registrations", "permission": "registrations.review"},
        {"label": "Matches", "path": "/management/matches", "permission": "matches.control"},
        {"label": "Players", "path": "/management/players", "permission": "players.manage"},
        {"label": "Announcements", "path": "/management/announcements", "permission": "announcements.manage"},
        {"label": "Reports", "path": "/management/reports", "permission": "reports.view_assigned"},
    ],
    "user": [
        {"label": "Dashboard", "path": "/user/dashboard", "permission": "registrations.view_own"},
        {"label": "Profile", "path": "/user/profile", "permission": "profile.manage"},
        {"label": "Registrations", "path": "/user/registrations", "permission": "registrations.view_own"},
        {"label": "Payments", "path": "/user/payments", "permission": "payments.view_own"},
        {"label": "Certificates", "path": "/user/certificates", "permission": "certificates.download"},
        {"label": "Schedules", "path": "/user/schedules", "permission": "schedules.view_own"},
        {"label": "Documents", "path": "/user/documents", "permission": "documents.view_own"},
    ],
}


def role_profile(role: str) -> dict:
    return {
        "role": role,
        "label": ROLE_LABELS.get(role, role),
        "homePath": ROLE_HOME.get(role, "/login"),
        "permissions": ROLE_PERMISSIONS.get(role, []),
        "programs": ROLE_PROGRAMS.get(role, []),
    }
