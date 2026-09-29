from __future__ import annotations

import json
from dataclasses import dataclass, field
from enum import Enum


class Quality(str, Enum):
    GOOD = "good"
    BAD = "bad"


@dataclass
class Alarm:
    tag: str
    active: bool = False
    latched: bool = False
    transitions: int = 0

    def raise_alarm(self) -> None:
        if not self.active:
            self.transitions += 1
        self.active = True
        self.latched = True

    def clear_condition(self) -> None:
        self.active = False


@dataclass
class OffshorePlant:
    gas_trip_ppm: float = 100.0
    high_pressure_bar: float = 180.0
    pump_running: bool = False
    valve_percent: float = 35.0
    inlet_pressure_bar: float = 92.0
    outlet_pressure_bar: float = 88.0
    flow_m3h: float = 0.0
    gas_ppm: float = 3.0
    scan_number: int = 0
    quality: Quality = Quality.GOOD
    alarms: dict[str, Alarm] = field(default_factory=lambda: {
        "gas_high": Alarm("gas_high"),
        "pressure_high": Alarm("pressure_high"),
    })

    def write_register(self, address: int, value: int) -> None:
        if not 0 <= value <= 65535:
            raise ValueError("register value must fit uint16")
        if address == 0:
            if value not in (0, 1):
                raise ValueError("pump command accepts 0 or 1")
            if value == 1 and self._tripped():
                raise PermissionError("start inhibited by active trip")
            self.pump_running = bool(value)
            return
        if address == 4:
            if value > 1000:
                raise ValueError("valve command must be in range 0..1000")
            self.valve_percent = value / 10
            return
        raise PermissionError("register is read-only or unmapped")

    def scan(self, elapsed_seconds: float = 1.0) -> dict[str, float | int | str | bool]:
        if not 0 < elapsed_seconds <= 10:
            raise ValueError("scan interval must be in range (0, 10]")
        self.scan_number += 1
        if self.pump_running and not self._tripped():
            target_flow = self.valve_percent * 0.42
            self.flow_m3h += (target_flow - self.flow_m3h) * min(1.0, elapsed_seconds / 3)
            self.outlet_pressure_bar = self.inlet_pressure_bar + self.flow_m3h * 1.6
        else:
            self.flow_m3h *= max(0.0, 1 - elapsed_seconds / 2)
            self.outlet_pressure_bar += (self.inlet_pressure_bar - self.outlet_pressure_bar) * min(1.0, elapsed_seconds / 4)
        if self.gas_ppm >= self.gas_trip_ppm:
            self.alarms["gas_high"].raise_alarm()
            self.pump_running = False
        if self.outlet_pressure_bar >= self.high_pressure_bar:
            self.alarms["pressure_high"].raise_alarm()
            self.pump_running = False
        self._refresh_alarm_conditions()
        return self.snapshot()

    def acknowledge(self, tag: str) -> None:
        alarm = self.alarms.get(tag)
        if alarm is None:
            raise KeyError(tag)
        if alarm.active:
            raise PermissionError("active alarm condition must clear before reset")
        alarm.latched = False

    def set_sensor(self, tag: str, value: float, quality: Quality = Quality.GOOD) -> None:
        if tag == "gas_ppm":
            if value < 0:
                raise ValueError("gas concentration cannot be negative")
            self.gas_ppm = value
        elif tag == "inlet_pressure_bar":
            if value < 0:
                raise ValueError("pressure cannot be negative")
            self.inlet_pressure_bar = value
        else:
            raise KeyError(tag)
        self.quality = quality

    def snapshot(self) -> dict[str, float | int | str | bool]:
        return {
            "scan": self.scan_number,
            "pump_running": self.pump_running,
            "valve_percent": round(self.valve_percent, 1),
            "flow_m3h": round(self.flow_m3h, 2),
            "inlet_pressure_bar": round(self.inlet_pressure_bar, 2),
            "outlet_pressure_bar": round(self.outlet_pressure_bar, 2),
            "gas_ppm": round(self.gas_ppm, 2),
            "quality": self.quality.value,
            "trip": self._tripped(),
            "alarms": {name: {"active": alarm.active, "latched": alarm.latched} for name, alarm in self.alarms.items()},
        }

    def modbus_registers(self) -> dict[int, int]:
        return {
            0: int(self.pump_running),
            1: round(self.flow_m3h * 10),
            2: round(self.outlet_pressure_bar * 10),
            3: round(self.gas_ppm * 10),
            4: round(self.valve_percent * 10),
            5: int(self._tripped()),
            6: self.scan_number % 65536,
        }

    def _tripped(self) -> bool:
        return any(alarm.latched for alarm in self.alarms.values())

    def _refresh_alarm_conditions(self) -> None:
        if self.gas_ppm < self.gas_trip_ppm:
            self.alarms["gas_high"].clear_condition()
        if self.outlet_pressure_bar < self.high_pressure_bar:
            self.alarms["pressure_high"].clear_condition()


def main() -> None:
    plant = OffshorePlant()
    plant.write_register(0, 1)
    samples = [plant.scan() for _ in range(5)]
    print(json.dumps({"samples": samples, "registers": plant.modbus_registers()}, indent=2))


if __name__ == "__main__":
    main()
