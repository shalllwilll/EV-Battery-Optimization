"""HTTP contracts. Engine result models are reused as-is so every number keeps its evidence label."""
from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from engine.bus.scenario import Scenario
from engine.bus.translate import CellConditions
from engine.decide.cost import CostResult
from engine.decide.range import RangeResult
from engine.decide.replacement import ReplacementResult
from engine.labels import Labelled
from engine.decide.compare import Delta
from engine.decide.recommend import RecommendResult

DISCLAIMER = ("Prior mode: capacity curves come from published laboratory-fitted LFP cell models (NREL BLAST-Lite) and scenario inputs "
              "are assumptions. Nothing here has been validated on buses.")
MAX_DRAWS = 5000


class PredictRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    mode: str = Field(default="prior", description="Only 'prior' exists in v1; anything else gets a 400")
    scenario: Scenario
    n_draws: int = Field(default=2000, ge=200, le=MAX_DRAWS, description="Monte Carlo draws (lab engine only; the default reference engine runs a fixed 50-run ensemble and ignores n_draws and seed)")
    seed: int = Field(default=0, ge=0, le=2**31 - 1, description="Lab engine only; ignored by the reference engine, which has nothing random")
    range_temperature_mode: Literal["none", "datasheet_example"] = "none"


class DriverSplit(BaseModel):
    calendar_share: Labelled
    cycling_share: Labelled


class PredictionResult(BaseModel):
    mode: Literal["prior"] = "prior"
    model_version: str
    disclaimer: str = DISCLAIMER
    scenario: Scenario
    conditions: CellConditions
    replacement: ReplacementResult
    range: RangeResult
    cost: CostResult
    driver_split: DriverSplit
    warnings: list[str]


class CompareRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    mode: str = Field(default="prior", description="Only 'prior' exists in v1; anything else gets a 400")
    scenarios: list[Scenario] = Field(min_length=2, max_length=4, description="first scenario is the base; the rest are variants")
    n_draws: int = Field(default=2000, ge=200, le=MAX_DRAWS)
    seed: int = Field(default=0, ge=0, le=2**31 - 1)


class CompareResult(BaseModel):
    mode: Literal["prior"] = "prior"
    model_version: str
    disclaimer: str = DISCLAIMER
    scenarios: list[Scenario]
    replacements: list[ReplacementResult] = Field(description="aligned with `scenarios`; computed on shared random draws")
    deltas: list[Delta] = Field(description="variant minus base, one per variant (months to threshold)")
    notes: list[str]
    warnings: list[str]


class RecommendRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    mode: str = Field(default="prior", description="Only 'prior' exists in v1; anything else gets a 400")
    scenario: Scenario = Field(description="Bus A: the client's current usage")
    reserve_fraction: float = Field(default=0.2, ge=0.0, le=0.5, description="safety reserve on the daily route, at replacement time")
    n_draws: int = Field(default=2000, ge=200, le=MAX_DRAWS)
    seed: int = Field(default=0, ge=0, le=2**31 - 1)


class RecommendResponse(RecommendResult):
    model_version: str
    disclaimer: str = DISCLAIMER


class LoginRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    username: str = Field(min_length=1, max_length=64)
    password: str = Field(min_length=1, max_length=128)


class LoginResponse(BaseModel):
    access_token: str
    token_type: Literal["bearer"] = "bearer"
    expires_in: int = Field(description="seconds")
    username: str
