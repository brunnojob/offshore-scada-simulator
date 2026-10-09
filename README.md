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

## Optional report archive

Export a JSON report from the command above, then run `python cloud/sync.py enqueue result.json --project offshore-scada-simulator` and `python cloud/sync.py sync`. Synchronization requires `BRUNNODEV_ACCESS_TOKEN` and the external operations API; the local outbox retains unacknowledged reports.

## License

Original source and documentation are MIT licensed; see [LICENSE](LICENSE). Third-party dependencies and media retain their respective terms. Maintained by [Brunno Dev](https://brunnodev.store).
