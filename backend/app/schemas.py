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

DISCLAIMER = ("Prior mode: models are fitted on public laboratory cell data and scenario inputs are assumptions. "
              "Nothing here has been validated on buses.")
MAX_DRAWS = 5000


class PredictRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    scenario: Scenario
    n_draws: int = Field(default=2000, ge=200, le=MAX_DRAWS, description="Monte Carlo draws; fixed seed makes results repeatable")
    seed: int = Field(default=0, ge=0, le=2**31 - 1)
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
