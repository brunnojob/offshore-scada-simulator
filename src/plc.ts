export type MotorState = "STOPPED" | "STARTING" | "RUNNING" | "STOPPING" | "TRIPPED"

export type SafetyInputs = {
  emergencyStop: boolean
  guardClosed: boolean
  pressureHealthy: boolean
  overload: boolean
}

export type PlcEvent = {
  sequence: number
  timestamp: number
  from: MotorState
  to: MotorState
  cause: string
}

export class MotorController {
  state: MotorState = "STOPPED"
  private stateSince = 0
  private sequence = 0
  private readonly events: PlcEvent[] = []
  private inputs: SafetyInputs = {
    emergencyStop: false,
    guardClosed: true,
    pressureHealthy: true,
    overload: false
  }

  constructor(
    private readonly startDelayMs = 1_500,
    private readonly stopDelayMs = 800
  ) {}

  updateInputs(inputs: SafetyInputs, now = Date.now()): MotorState {
    this.inputs = { ...inputs }
    if (this.hasTrip())
      this.transition("TRIPPED", "safety_input_trip", now)
    return this.state
  }

  command(action: "START" | "STOP" | "RESET", now = Date.now()): MotorState {
    if (action === "START") {
      if (this.state !== "STOPPED")
        throw new Error("start_requires_stopped")
      if (!this.canStart())
        throw new Error("start_interlock_open")
      this.transition("STARTING", "operator_start", now)
      return this.state
    }
    if (action === "STOP") {
      if (this.state === "RUNNING" || this.state === "STARTING")
        this.transition("STOPPING", "operator_stop", now)
      return this.state
    }
    if (this.state !== "TRIPPED" || this.hasTrip())
      throw new Error("reset_requires_cleared_trip")
    this.transition("STOPPED", "operator_reset", now)
    return this.state
  }

  scan(now = Date.now()): MotorState {
    if (this.hasTrip()) {
      this.transition("TRIPPED", "safety_input_trip", now)
      return this.state
    }
    if (this.state === "STARTING" && now - this.stateSince >= this.startDelayMs)
      this.transition("RUNNING", "starter_feedback", now)
    if (this.state === "STOPPING" && now - this.stateSince >= this.stopDelayMs)
      this.transition("STOPPED", "zero_speed_feedback", now)
    return this.state
  }

  snapshot(): { state: MotorState; inputs: SafetyInputs; sequence: number; stateSince: number } {
    return { state: this.state, inputs: { ...this.inputs }, sequence: this.sequence, stateSince: this.stateSince }
  }

  history(): PlcEvent[] {
    return this.events.map(event => ({ ...event }))
  }

  private canStart(): boolean {
    return !this.hasTrip() && this.inputs.guardClosed && this.inputs.pressureHealthy
  }

  private hasTrip(): boolean {
    return this.inputs.emergencyStop || this.inputs.overload || !this.inputs.guardClosed || !this.inputs.pressureHealthy
  }

  private transition(next: MotorState, cause: string, now: number): void {
    if (this.state === next)
      return
    const prior = this.state
    this.state = next
    this.stateSince = now
    this.events.push({
      sequence: this.sequence++,
      timestamp: now,
      from: prior,
      to: next,
      cause
    })
  }
}
