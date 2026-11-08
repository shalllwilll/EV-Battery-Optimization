from __future__ import annotations

from fastapi import APIRouter, Depends, Request, Response
from fastapi.concurrency import run_in_threadpool

from backend.app import service
from backend.app.auth import require_user
from backend.app import reference
from backend.app.config import get_settings
from backend.app.errors import ApiError
from backend.app.schemas import CompareRequest, CompareResult, PredictionResult, PredictRequest, RecommendRequest, RecommendResponse

router = APIRouter(prefix="/api/v1", dependencies=[Depends(require_user)])


def _check_mode(mode: str) -> None:
    if mode != "prior":
        raise ApiError(400, "unsupported_mode", f"Mode {mode!r} is not available: v1 runs in 'prior' mode only. "
                       "Calibrated mode needs operator data and is not wired into the API.")


@router.post("/predict", response_model=PredictionResult, tags=["predict"],
             summary="Forecast battery retention, replacement window, range and cost per km for one scenario")
async def predict(req: PredictRequest, request: Request, response: Response):
    _check_mode(req.mode)
    st = request.app.state
    key = service.LRUCache.key(req, st.model_version)
    hit = st.cache.get(key)
    if hit is not None:
        response.headers["X-Cache"] = "HIT"
        return hit
    result = await run_in_threadpool(service.run_prediction, req, st.models, st.model_version)
    st.cache.put(key, result)
    response.headers["X-Cache"] = "MISS"
    return result


@router.post("/compare", response_model=CompareResult, tags=["predict"],
             summary="Paired what-if comparison of 2-4 scenarios on shared random draws")
async def compare(req: CompareRequest, request: Request, response: Response):
    _check_mode(req.mode)
    st = request.app.state
    key = service.LRUCache.key(req, st.model_version)
    hit = st.cache.get(key)
    if hit is not None:
        response.headers["X-Cache"] = "HIT"
        return hit
    result = await run_in_threadpool(service.run_compare, req, st.models, st.model_version)
    st.cache.put(key, result)
    response.headers["X-Cache"] = "MISS"
    return result


@router.post("/recommend", response_model=RecommendResponse, tags=["predict"],
             summary="Search real usage levers for a bus and return goal-based presets with plain-language explanations")
async def recommend(req: RecommendRequest, request: Request, response: Response):
    _check_mode(req.mode)
    st = request.app.state
    key = service.LRUCache.key(req, st.model_version)
    hit = st.cache.get(key)
    if hit is not None:
        response.headers["X-Cache"] = "HIT"
        return hit
    result = await run_in_threadpool(service.run_recommend, req, st.models, st.model_version)
    st.cache.put(key, result)
    response.headers["X-Cache"] = "MISS"
    return result


@router.get("/presets", tags=["reference"], summary="Bus archetypes with every default's source and evidence level")
async def get_presets():
    return {"mode": "prior", "presets": await run_in_threadpool(reference.presets_json)}


@router.get("/zones", tags=["reference"], summary="Climate zones: monthly air-temperature statistics and data provenance")
async def get_zones():
    return await run_in_threadpool(reference.zones)


@router.get("/evidence", tags=["reference"], summary="Datasets, measured model errors, training coverage and known limitations")
async def get_evidence(request: Request):
    st = request.app.state
    return await run_in_threadpool(reference.evidence, get_settings().artifact_dir, st.versions, st.model_version, st.models)
