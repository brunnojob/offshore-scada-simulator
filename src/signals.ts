export type SignalQuality = "good" | "uncertain" | "bad"

export type SignalInput = {
  source: string
  tag: string
  sequence: number
  timestamp: number
  raw: number
  quality: SignalQuality
}

export type SignalPoint = {
  source: string
  tag: string
  sequence: number
  timestamp: number
  raw: number
  engineeringValue: number
  unit: string
  quality: SignalQuality
}

export type SignalSpec = {
  rawMin: number
  rawMax: number
  euMin: number
  euMax: number
  unit: string
  alarmHigh?: number
  alarmReset?: number
  confirmations?: number
}

export class SignalNormalizer {
  private readonly sequences = new Map<string, number>()

  constructor(
    private readonly specs: Record<string, SignalSpec>,
    private readonly maxAgeMs = 60_000,
    private readonly futureSkewMs = 5_000
  ) {}

  normalize(input: SignalInput, now = Date.now()): SignalPoint {
    const spec = this.specs[input.tag]
    if (!spec || !input.source || !Number.isInteger(input.sequence) || input.sequence < 0)
      throw new Error("invalid_signal_identity")
    if (!Number.isFinite(input.raw) || input.raw < spec.rawMin || input.raw > spec.rawMax)
      throw new Error("raw_value_out_of_range")
    if (input.quality === "bad")
      throw new Error("bad_signal_quality")
    if (!Number.isFinite(input.timestamp) || input.timestamp < now - this.maxAgeMs || input.timestamp > now + this.futureSkewMs)
      throw new Error("stale_or_future_signal")
    const key = `${input.source}:${input.tag}`
    const prior = this.sequences.get(key) ?? -1
    if (input.sequence <= prior)
      throw new Error("out_of_order_signal")
    this.sequences.set(key, input.sequence)
    const ratio = (input.raw - spec.rawMin) / (spec.rawMax - spec.rawMin)
    return {
      ...input,
      engineeringValue: spec.euMin + ratio * (spec.euMax - spec.euMin),
      unit: spec.unit
    }
  }
}

export type AlarmSnapshot = {
  active: boolean
  latched: boolean
  confirmations: number
  lastValue: number
}

export class AlarmEngine {
  private readonly states = new Map<string, AlarmSnapshot>()

  evaluate(point: SignalPoint, spec: SignalSpec): AlarmSnapshot | undefined {
    if (spec.alarmHigh === undefined || spec.alarmReset === undefined)
      return undefined
    const prior = this.states.get(point.tag) ?? {
      active: false,
      latched: false,
      confirmations: 0,
      lastValue: point.engineeringValue
    }
    if (point.engineeringValue >= spec.alarmHigh) {
      prior.confirmations += 1
      if (prior.confirmations >= (spec.confirmations ?? 2)) {
        prior.active = true
        prior.latched = true
      }
    } else {
      prior.confirmations = 0
      if (point.engineeringValue <= spec.alarmReset)
        prior.active = false
    }
    prior.lastValue = point.engineeringValue
    this.states.set(point.tag, prior)
    return { ...prior }
  }

  acknowledge(tag: string): void {
    const state = this.states.get(tag)
    if (!state)
      throw new Error("alarm_not_found")
    if (state.active)
      throw new Error("alarm_condition_active")
    state.latched = false
  }
}
