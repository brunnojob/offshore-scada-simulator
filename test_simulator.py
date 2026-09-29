import unittest

from simulator import OffshorePlant, Quality


class OffshorePlantTests(unittest.TestCase):
    def test_scan_updates_process_and_register_map(self):
        plant = OffshorePlant()
        plant.write_register(0, 1)
        sample = plant.scan()
        self.assertGreater(sample["flow_m3h"], 0)
        self.assertEqual(plant.modbus_registers()[0], 1)

    def test_gas_trip_stops_pump_and_latches(self):
        plant = OffshorePlant()
        plant.write_register(0, 1)
        plant.set_sensor("gas_ppm", 120)
        sample = plant.scan()
        self.assertFalse(sample["pump_running"])
        self.assertTrue(sample["trip"])
        with self.assertRaises(PermissionError):
            plant.write_register(0, 1)

    def test_alarm_reset_requires_safe_condition(self):
        plant = OffshorePlant()
        plant.set_sensor("gas_ppm", 120)
        plant.scan()
        with self.assertRaises(PermissionError):
            plant.acknowledge("gas_high")
        plant.set_sensor("gas_ppm", 2, Quality.GOOD)
        plant.scan()
        plant.acknowledge("gas_high")
        self.assertFalse(plant.alarms["gas_high"].latched)

    def test_register_write_access_is_restricted(self):
        plant = OffshorePlant()
        with self.assertRaises(PermissionError):
            plant.write_register(2, 100)


if __name__ == "__main__":
    unittest.main()
