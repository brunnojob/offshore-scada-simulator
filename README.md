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

Use the [shared operations archive client](https://github.com/brunnojob/vercel-home-telemetry-api/tree/main/cloud) to queue `result.json` under project `offshore-scada-simulator`. The client uses `BRUNNODEV_ACCESS_TOKEN` and retains unacknowledged reports locally.

## License

Original source and documentation are MIT licensed; see [LICENSE](LICENSE). Third-party dependencies and media retain their respective terms. Maintained by [Brunno Dev](https://brunnodev.store).
