#!/usr/bin/env bash
# Starts the API on a spare port, calls every endpoint once, checks the key facts, stops the server.
set -euo pipefail
cd "$(dirname "$0")/.."
PORT=${PORT:-$(.venv/bin/python -c "import socket; s=socket.socket(); s.bind(('127.0.0.1', 0)); print(s.getsockname()[1])")}
.venv/bin/uvicorn backend.app.main:app --port "$PORT" --log-level warning &
PID=$!
trap 'kill $PID 2>/dev/null || true' EXIT
for _ in $(seq 1 50); do curl -sf "localhost:$PORT/api/v1/health" >/dev/null && break; sleep 0.2; done
B="localhost:$PORT/api/v1"
curl -sf "$B/health"   | .venv/bin/python -c "import sys,json; j=json.load(sys.stdin); assert j['status']=='ok' and j['mode']=='prior'"
curl -sf "$B/presets"  | .venv/bin/python -c "import sys,json; j=json.load(sys.stdin); assert {p['id'] for p in j['presets']}=={'12m','9m'}"
curl -sf "$B/zones"    | .venv/bin/python -c "import sys,json; j=json.load(sys.stdin); assert len(j['zones'])==4 and j['provenance']['synthetic'] is False"
curl -sf "$B/evidence" | .venv/bin/python -c "import sys,json; j=json.load(sys.stdin); assert j['validated_on_buses'] is False and j['datasets']"
SC='{"pack_kwh":350,"kwh_per_km":1.2,"km_per_day":200,"operating_days_per_year":340,"charge_power_kw":120}'
curl -sf -X POST "$B/predict" -H 'Content-Type: application/json' -d "{\"scenario\":$SC}" \
  | .venv/bin/python -c "import sys,json; j=json.load(sys.stdin); assert j['mode']=='prior' and j['replacement']['months_p50']['unit']=='months'"
curl -sf -X POST "$B/compare" -H 'Content-Type: application/json' -d "{\"scenarios\":[$SC,${SC%\}},\"soc_max_pct\":90}]}" \
  | .venv/bin/python -c "import sys,json; j=json.load(sys.stdin); assert len(j['deltas'])==1"
code=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$B/predict" -H 'Content-Type: application/json' -d '{"scenario":{}}')
[ "$code" = 422 ] || { echo "expected 422 for invalid body, got $code"; exit 1; }
echo "smoke OK"
