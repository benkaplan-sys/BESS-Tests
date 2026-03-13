"""Tests for the BESS simulation module."""

import pytest
from bess import BatteryEnergyStorageSystem


def test_simulate_cycle_charge_then_discharge():
    bess = BatteryEnergyStorageSystem(capacity_kwh=100, max_power_kw=50, efficiency=1.0)
    steps = [
        (50, 1.0, "charge"),     # add 50 kWh -> SoC 0.50
        (50, 0.5, "charge"),     # add 25 kWh -> SoC 0.75
        (25, 1.0, "discharge"),  # remove 25 kWh -> SoC 0.50
    ]
    history = bess.simulate_cycle(steps)
    assert history == [0.0, 0.5, 0.75, 0.5]


def test_simulate_cycle_returns_initial_soc():
    bess = BatteryEnergyStorageSystem(capacity_kwh=100, max_power_kw=50)
    bess.charge(50, 1.0)  # pre-charge to 50 %
    history = bess.simulate_cycle([])
    assert len(history) == 1
    assert history[0] == pytest.approx(bess.state_of_charge)


def test_simulate_cycle_clamps_at_full():
    bess = BatteryEnergyStorageSystem(capacity_kwh=100, max_power_kw=200, efficiency=1.0)
    steps = [(200, 10.0, "charge")]  # would overshoot, must clamp at 1.0
    history = bess.simulate_cycle(steps)
    assert history[-1] == pytest.approx(1.0)


def test_simulate_cycle_clamps_at_empty():
    bess = BatteryEnergyStorageSystem(capacity_kwh=100, max_power_kw=200, efficiency=1.0)
    steps = [(200, 10.0, "discharge")]  # battery is empty, SoC stays 0
    history = bess.simulate_cycle(steps)
    assert history[-1] == pytest.approx(0.0)


def test_simulate_cycle_invalid_mode():
    bess = BatteryEnergyStorageSystem(capacity_kwh=100, max_power_kw=50)
    with pytest.raises(ValueError, match="Unknown mode"):
        bess.simulate_cycle([(10, 1.0, "hold")])
