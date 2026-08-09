from __future__ import annotations

from app.db.schema import init_schema
from app.db.seed import seed_data, seed_operational_data
from app.services.tournament_status import apply_registration_window_statuses


def initialize_database(seed: bool = True) -> None:
    init_schema()
    if seed:
        seed_data()
        seed_operational_data()
    apply_registration_window_statuses()
