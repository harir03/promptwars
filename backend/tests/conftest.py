"""Shared pytest configuration and fixtures.

Sets up test environment with known secrets so admin
endpoint tests work deterministically.
"""

import os
import sys
from pathlib import Path

# Ensure backend root is on sys.path for app imports
backend_root = Path(__file__).parent.parent
if str(backend_root) not in sys.path:
    sys.path.insert(0, str(backend_root))

# Set test environment variables BEFORE any app imports.
# This ensures get_settings() picks up the test passkey.
# OWASP A02: these are test-only values, never used in production.
os.environ.setdefault("ADMIN_PASSKEY", "test-admin-passkey-for-ci")
os.environ.setdefault("GOOGLE_API_KEY", "")
os.environ.setdefault("ENVIRONMENT", "development")
