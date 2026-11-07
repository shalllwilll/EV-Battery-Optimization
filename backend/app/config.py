"""Settings from environment variables with safe defaults (no secrets are needed by this app)."""
from __future__ import annotations

import os
from dataclasses import dataclass, field


def _origins() -> list[str]:
    raw = os.environ.get("EV_ALLOWED_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173")
    return [o.strip() for o in raw.split(",") if o.strip()]


@dataclass(frozen=True)
class Settings:
    allowed_origins: list[str] = field(default_factory=_origins)
    max_body_bytes: int = field(default_factory=lambda: int(os.environ.get("EV_MAX_BODY_BYTES", 1_000_000)))
    artifact_dir: str = field(default_factory=lambda: os.environ.get("EV_ARTIFACT_DIR", "engine/artifacts"))


def get_settings() -> Settings:
    return Settings()
