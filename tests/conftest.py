import os

import pytest

# Existing API tests exercise the model, not login; auth has its own tests (tests/test_api_auth.py) that switch it on.
os.environ.setdefault("EV_AUTH_REQUIRED", "false")
