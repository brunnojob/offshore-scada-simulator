# Offshore SCADA Simulator

A TypeScript industrial telemetry and PLC lab with WebSocket signal streaming, engineering-unit normalization, latched alarms, safety interlocks and a Modbus TCP register map.

## Run

```bash
npm install
npm test
npm run dev
```

WebSocket and Modbus TCP bind to loopback by default. This is a simulator; it must not control live equipment.
