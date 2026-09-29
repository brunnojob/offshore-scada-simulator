import { MotorController } from "./plc.ts"

const STATE_CODES = {
  STOPPED: 0,
  STARTING: 1,
  RUNNING: 2,
  STOPPING: 3,
  TRIPPED: 4
} as const

export class ModbusRegisterBank {
  constructor(private readonly motor: MotorController) {}

  read(start: number, quantity: number): number[] {
    if (!Number.isInteger(start) || !Number.isInteger(quantity) || quantity < 1 || quantity > 125 || start < 0 || start + quantity > 16)
      throw new Error("illegal_data_address")
    const snapshot = this.motor.snapshot()
    const map = new Map<number, number>([
      [0, STATE_CODES[snapshot.state]],
      [1, Number(snapshot.inputs.emergencyStop)],
      [2, Number(snapshot.inputs.guardClosed)],
      [3, Number(snapshot.inputs.pressureHealthy)],
      [4, Number(snapshot.inputs.overload)],
      [5, snapshot.sequence & 0xffff],
      [6, snapshot.stateSince & 0xffff],
      [10, 0]
    ])
    return Array.from({ length: quantity }, (_, offset) => map.get(start + offset) ?? 0)
  }

  write(address: number, value: number, now = Date.now()): void {
    if (address !== 10)
      throw new Error("read_only_register")
    const actions = new Map([[1, "START"], [2, "STOP"], [3, "RESET"]] as const)
    const action = actions.get(value)
    if (!action)
      throw new Error("illegal_command")
    this.motor.command(action, now)
  }
}

export function handleModbusTcpFrame(request: Uint8Array, bank: ModbusRegisterBank): Uint8Array {
  if (request.length < 8)
    throw new Error("incomplete_mbap_frame")
  const view = new DataView(request.buffer, request.byteOffset, request.byteLength)
  const transaction = view.getUint16(0)
  const protocol = view.getUint16(2)
  const length = view.getUint16(4)
  const unit = view.getUint8(6)
  const functionCode = view.getUint8(7)
  if (protocol !== 0 || request.length !== length + 6 || length < 2)
    throw new Error("invalid_mbap_frame")
  let response: number[]
  try {
    if (functionCode === 3 && length === 6) {
      const start = view.getUint16(8)
      const quantity = view.getUint16(10)
      const registers = bank.read(start, quantity)
      response = [3, registers.length * 2, ...registers.flatMap(value => [value >> 8, value & 255])]
    } else if (functionCode === 6 && length === 6) {
      const address = view.getUint16(8)
      const value = view.getUint16(10)
      bank.write(address, value)
      response = [6, address >> 8, address & 255, value >> 8, value & 255]
    } else {
      throw new Error("illegal_function")
    }
  } catch (error) {
    const code = error instanceof Error && error.message === "illegal_function" ? 1 : 2
    response = [functionCode | 128, code]
  }
  const bodyLength = response.length + 1
  const output = new Uint8Array(7 + response.length)
  const out = new DataView(output.buffer)
  out.setUint16(0, transaction)
  out.setUint16(2, 0)
  out.setUint16(4, bodyLength)
  out.setUint8(6, unit)
  output.set(response, 7)
  return output
}
