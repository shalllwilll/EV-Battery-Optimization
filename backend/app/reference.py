"""Reference data served by GET endpoints. Everything is read from repo files (archetypes, weather, provenance, metrics):
no number in these responses is typed by hand."""
from __future__ import annotations

import json
import os

from engine.bus.scenario import Scenario
from engine.cell.uncertainty import Models
from engine.labels import L

PROV_DIR = "engine/data/provenance"
ZONES_PATH = "engine/data/zones.json"
ARCH_PATH = "engine/bus/archetypes.json"

UNITS = {"pack_kwh": "kWh", "kwh_per_km": "kWh/km", "km_per_day": "km/day", "charge_power_kw": "kW", "operating_days_per_year": "days/year"}
USED_FOR = {
    "hust": "Cycling-ageing fit and early-life cycle-life predictor (LFP cells, laboratory)",
    "stanford_calendar": "Calendar-ageing fit and cross-laboratory check (LFP cells, storage)",
    "naumann_calendar": "Calendar-ageing fit and cross-laboratory check (LFP cells, storage)",
    "weather": "Monthly air temperature for the four climate zones (measured/reanalysis, not battery temperature)",
    "evbattery": "Method demonstration for the future Calibrated mode only (not LFP, not used in the Prior)",
}
LIMITATIONS = [
    "No public LFP bus-pack data exists: nothing in this tool has been validated on buses.",
    "The cycling data are high-rate laboratory cells at one temperature; the model has no C-rate effect, so low-rate bus cycling is probably overstated and replacement timing too early.",
    "The temperature dependence of cycling ageing is an assumed activation energy, not fitted to data.",
    "Depth-of-discharge effects, HVAC load and seasonal energy use are not modelled.",
    "The weakest-cell pack penalty is an assumption exposed as a range.",
    "Calendar ageing is optimistic near ambient temperature at full state of charge (known-point check, see model card).",
    "Band widening outside the training range uses an assumed factor.",
    "BMS-reported state of health is never treated as ground truth.",
]


def _load(path: str):
    with open(path) as f:
        return json.load(f)


def presets() -> list[dict]:
    arch = _load(ARCH_PATH)
    out = []
    for pid, a in arch["archetypes"].items():
        fields = {}
        for k, unit in UNITS.items():
            v = a[k]
            fields[k] = {"value": L(float(v["value"]), unit, v["evidence_level"], v["source"]),
                         "range": L([float(x) for x in v["range"]], unit, "assumption", "plausible design range") if "range" in v else None}
        out.append({"id": pid, "label": a["label"], "fields": fields,
                    "scenario": Scenario.from_preset(pid).model_dump()})
    return out


def presets_json() -> list[dict]:
    return [{**p, "fields": {k: {kk: (vv.model_dump() if vv is not None else None) for kk, vv in f.items()}
                             for k, f in p["fields"].items()}} for p in presets()]


def zones() -> dict:
    z = _load(ZONES_PATH)
    prov = _load(f"{PROV_DIR}/weather.json")
    return {"data_kind": "measured_weather", "note": z["note"], "period": z["period"],
            "units": {"tmean_c": "C", "tmax_mean_c": "C", "tmin_mean_c": "C", "tmax_p95_c": "C", "diurnal_range_c": "C",
                      "elevation_m": "m", "n_days": "days"},
            "provenance": {k: prov[k] for k in ("source_url", "licence", "attribution", "limitations", "period", "synthetic")},
            "zones": [{"id": k, **v} for k, v in z["zones"].items()]}


def evidence(artifact_dir: str, versions: dict, model_version: str, models: Models) -> dict:
    datasets = []
    for fn in sorted(os.listdir(PROV_DIR)):
        if fn.endswith(".json"):
            did = fn[:-5]
            datasets.append({"id": did, "used_for": USED_FOR.get(did, ""), **_load(f"{PROV_DIR}/{fn}")})
    c = models.cyc
    return {"mode": "prior", "validated_on_buses": False, "model_version": model_version, "artifacts": versions,
            "datasets": datasets, "metrics": _load(f"{artifact_dir}/metrics.json"),
            "uncertainty": _load(f"{artifact_dir}/uncertainty.json"),
            "training_coverage": {"cycling_temperature_c": list(c.valid_temp_c), "cycling_c_rate": list(c.valid_c_rate),
                                  "cycling_efc_max": c.valid_efc_max},
            "limitations": LIMITATIONS}
