from __future__ import annotations

import argparse

from app.db.init_db import initialize_database
from app.services.job_queue import worker_loop


def main() -> None:
    parser = argparse.ArgumentParser(description="Smart Sportz backend operations")
    parser.add_argument("command", choices=["init-db", "worker"], help="Operation to run")
    parser.add_argument("--no-seed", action="store_true", help="Create schema only")
    args = parser.parse_args()

    if args.command == "init-db":
        initialize_database(seed=not args.no_seed)
    if args.command == "worker":
        worker_loop()


if __name__ == "__main__":
    main()
