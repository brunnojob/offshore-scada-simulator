import test from "node:test";
import assert from "node:assert/strict";
import { MotorController } from "../src/plc.ts";

test("invalid timing cannot silently keep a starter energized", () => {
  for (const delay of [NaN, Infinity, -1, 0.5]) assert.throws(() => new MotorController(delay));
  const controller = new MotorController(100, 50);
  controller.updateInputs({ emergencyStop: false, guardClosed: true, pressureHealthy: true, overload: false }, 100);
  controller.command("START", 100);
  assert.throws(() => controller.scan(99), /invalid_motor_clock/);
  assert.throws(() => controller.scan(NaN), /invalid_motor_clock/);
  assert.equal(controller.scan(200), "RUNNING");
});
