# Offshore SCADA

A local server with WebSocket, Modbus TCP, signal normalization, acknowledged alarms, and history aggregated by time interval.

## Run

Requirements: Node.js 24 and TypeScript.

```sh
npm ci
npm test
npm run dev
```

## Behavior

WebSocket: `ws://127.0.0.1:8080/telemetry`. Modbus TCP: `127.0.0.1:1502`. `/history?tag=name&from=timestamp&to=timestamp&interval=1000` returns the mean, extremes, and latest valid sample. History is held in memory with limited retention; export relevant results for persistence.

## Result synchronization

The [operations archive](https://vercel-home-telemetry-api.vercel.app/laboratory.html?project=offshore-scada-simulator) stores execution results. Supabase migrations are in the [API repository](https://github.com/brunnojob/vercel-home-telemetry-api/tree/main/supabase/migrations).

```sh
python cloud/sync.py enqueue result.json --project offshore-scada-simulator
python cloud/sync.py sync
```

Set `BRUNNODEV_ACCESS_TOKEN` to your session token. The SQLite outbox retains reports until the server confirms persistence; identical content does not create duplicate records. Tokens are not stored in source code. To run the synchronization tests:

```sh
python -m unittest discover -s cloud
```
