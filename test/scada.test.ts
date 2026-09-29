import test from "node:test"
import assert from "node:assert/strict"
import { SignalNormalizer } from "../src/signals.ts"
import { MotorController } from "../src/plc.ts"
import { ModbusRegisterBank, handleModbusTcpFrame } from "../src/modbus.ts"

test("normalizes engineering units and rejects replayed sequence", () => {
  const normalizer = new SignalNormalizer({ pressure: { rawMin: 0, rawMax: 4095, euMin: 0, euMax: 250, unit: "bar" } })
  const input = { source: "pt-1", tag: "pressure", sequence: 1, timestamp: 1000, raw: 2048, quality: "good" as const }
  assert.ok(Math.abs(normalizer.normalize(input, 1000).engineeringValue - 125.03) < 0.1)
  assert.throws(() => normalizer.normalize(input, 1000), /out_of_order_signal/)
})

test("motor start requires interlocks and trips immediately", () => {
  const plc = new MotorController(100, 50)
  assert.throws(() => plc.command("START", 1000), /interlock_open/)
  plc.updateInputs({ emergencyStop: false, guardClosed: true, pressureHealthy: true, overload: false }, 1000)
  assert.equal(plc.command("START", 1000), "STARTING")
  assert.equal(plc.scan(1100), "RUNNING")
  assert.equal(plc.updateInputs({ emergencyStop: false, guardClosed: true, pressureHealthy: true, overload: true }, 1200), "TRIPPED")
})

test("Modbus TCP function 3 returns mapped holding registers", () => {
  const plc = new MotorController()
  plc.updateInputs({ emergencyStop: false, guardClosed: true, pressureHealthy: true, overload: false }, 100)
  const bank = new ModbusRegisterBank(plc)
  const request = Uint8Array.from([0, 7, 0, 0, 0, 6, 1, 3, 0, 0, 0, 2])
  const response = handleModbusTcpFrame(request, bank)
  assert.equal(response[0], 0)
  assert.equal(response[1], 7)
  assert.equal(response[7], 3)
  assert.equal(response[9], 0)
  assert.equal(response[11], 1)
})

test("Modbus writes only the command register", () => {
  const plc = new MotorController()
  const bank = new ModbusRegisterBank(plc)
  assert.throws(() => bank.write(0, 2), /read_only_register/)
  assert.throws(() => bank.write(10, 1), /start_interlock_open/)
})
