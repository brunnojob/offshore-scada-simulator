import { createServer } from "node:http"
import { createServer as createTcpServer } from "node:net"
import { WebSocketServer } from "ws"
import { AlarmEngine, SignalNormalizer } from "./signals.ts"
import { type SignalInput, type SignalSpec } from "./signals.ts"
import { MotorController } from "./plc.ts"
import { ModbusRegisterBank, handleModbusTcpFrame } from "./modbus.ts"

const specs: Record<string, SignalSpec> = {
  discharge_pressure: { rawMin: 0, rawMax: 4095, euMin: 0, euMax: 250, unit: "bar", alarmHigh: 180, alarmReset: 165, confirmations: 3 },
  vibration: { rawMin: 0, rawMax: 4095, euMin: 0, euMax: 25, unit: "mm/s", alarmHigh: 9, alarmReset: 6, confirmations: 2 }
}
const normalizer = new SignalNormalizer(specs)
const alarms = new AlarmEngine()
const motor = new MotorController()
const bank = new ModbusRegisterBank(motor)
const http = createServer((_, response) => {
  response.writeHead(200, { "content-type": "application/json" })
  response.end(JSON.stringify({ service: "offshore-scada-simulator", protocol: "websocket+modbus-tcp", mode: "simulation" }))
})
const webSocket = new WebSocketServer({ server: http, path: "/telemetry" })

webSocket.on("connection", socket => {
  socket.send(JSON.stringify({ type: "ready", state: motor.snapshot() }))
  socket.on("message", raw => {
    try {
      const input = JSON.parse(raw.toString()) as SignalInput
      const point = normalizer.normalize(input)
      const alarm = alarms.evaluate(point, specs[point.tag])
      const message = JSON.stringify({ type: "telemetry", point, alarm, plc: motor.snapshot() })
      for (const client of webSocket.clients)
        if (client.readyState === 1)
          client.send(message)
    } catch (error) {
      socket.send(JSON.stringify({ type: "rejected", reason: error instanceof Error ? error.message : "invalid_message" }))
    }
  })
})

const tcp = createTcpServer(socket => {
  let buffer = Buffer.alloc(0)
  socket.on("data", chunk => {
    buffer = Buffer.concat([buffer, chunk])
    while (buffer.length >= 7) {
      const length = buffer.readUInt16BE(4)
      const frameLength = length + 6
      if (buffer.length < frameLength)
        break
      const frame = buffer.subarray(0, frameLength)
      buffer = buffer.subarray(frameLength)
      try {
        socket.write(Buffer.from(handleModbusTcpFrame(frame, bank)))
      } catch {
        socket.destroy()
        return
      }
    }
  })
})

const wsPort = Number(process.env.WS_PORT ?? 8080)
const modbusPort = Number(process.env.MODBUS_PORT ?? 1502)
http.listen(wsPort, "127.0.0.1", () => process.stdout.write(`telemetry_ws=ws://127.0.0.1:${wsPort}/telemetry\n`))
tcp.listen(modbusPort, "127.0.0.1", () => process.stdout.write(`modbus_tcp=127.0.0.1:${modbusPort}\n`))
