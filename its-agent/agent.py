#!/usr/bin/env python3
"""Occupied ITS agent. Run `python agent.py --help`. See README.md and SETUP.md."""
import sys

if sys.version_info < (3, 11):
    sys.exit("Python 3.11 or newer is required (for tomllib).")

from occupied_agent.cli import main  # noqa: E402  (after the version check on purpose)

sys.exit(main())
