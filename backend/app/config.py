"""Settings from environment variables with safe defaults (no secrets are needed by this app)."""
from __future__ import annotations

import os
import secrets
from dataclasses import dataclass, field

# Without EV_AUTH_SECRET each process signs tokens with its own random key, so nobody can forge a token from the public
# source code. Sign-ins then end when the server restarts; with more than one worker, set EV_AUTH_SECRET.
_PROCESS_SECRET = secrets.token_urlsafe(32)


def _origins() -> list[str]:
    raw = os.environ.get("EV_ALLOWED_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173")
    return [o.strip() for o in raw.split(",") if o.strip()]


@dataclass(frozen=True)
class Settings:
    allowed_origins: list[str] = field(default_factory=_origins)
    max_body_bytes: int = field(default_factory=lambda: int(os.environ.get("EV_MAX_BODY_BYTES", 1_000_000)))
    artifact_dir: str = field(default_factory=lambda: os.environ.get("EV_ARTIFACT_DIR", "engine/artifacts"))
    # Demo login. Defaults are for local demos only; set real values in the environment (.env) for anything shared.
    auth_required: bool = field(default_factory=lambda: os.environ.get("EV_AUTH_REQUIRED", "true").lower() != "false")
    demo_user: str = field(default_factory=lambda: os.environ.get("EV_DEMO_USER", "demo"))
    demo_password: str = field(default_factory=lambda: os.environ.get("EV_DEMO_PASSWORD", "PackHorizon-2026"))
    auth_secret: str = field(default_factory=lambda: os.environ.get("EV_AUTH_SECRET") or _PROCESS_SECRET)
    token_ttl_s: int = field(default_factory=lambda: int(os.environ.get("EV_TOKEN_TTL_S", 8 * 3600)))


def get_settings() -> Settings:
    return Settings()
