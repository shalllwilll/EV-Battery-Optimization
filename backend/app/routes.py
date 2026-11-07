from __future__ import annotations

from fastapi import APIRouter, Request, Response
from fastapi.concurrency import run_in_threadpool

from backend.app import service
from backend.app.schemas import PredictionResult, PredictRequest

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
