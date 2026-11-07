from __future__ import annotations

from fastapi import APIRouter, Request, Response
from fastapi.concurrency import run_in_threadpool

from backend.app import service
from backend.app import reference
from backend.app.schemas import CompareRequest, CompareResult, PredictionResult, PredictRequest

router = APIRouter(prefix="/api/v1")


@router.post("/predict", response_model=PredictionResult, tags=["predict"],
             summary="Forecast battery retention, replacement window, range and cost per km for one scenario")
async def predict(req: PredictRequest, request: Request, response: Response):
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


@router.get("/presets", tags=["reference"], summary="Bus archetypes with every default's source and evidence level")
async def get_presets(request: Request):
    return {"mode": "prior", "presets": request.app.state.presets}


@router.get("/zones", tags=["reference"], summary="Climate zones: monthly air-temperature statistics and data provenance")
async def get_zones(request: Request):
    return request.app.state.zones


@router.get("/evidence", tags=["reference"], summary="Datasets, measured model errors, training coverage and known limitations")
async def get_evidence(request: Request):
    return request.app.state.evidence
