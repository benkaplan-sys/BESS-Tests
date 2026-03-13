"""Battery Energy Storage System (BESS) simulation module."""


class BatteryEnergyStorageSystem:
    """Simple BESS model tracking state of charge over charge/discharge cycles."""

    def __init__(self, capacity_kwh: float, max_power_kw: float, efficiency: float = 0.95):
        if capacity_kwh <= 0:
            raise ValueError("capacity_kwh must be positive")
        if max_power_kw <= 0:
            raise ValueError("max_power_kw must be positive")
        if not (0 < efficiency <= 1.0):
            raise ValueError("efficiency must be in (0, 1]")

        self.capacity_kwh = capacity_kwh
        self.max_power_kw = max_power_kw
        self.efficiency = efficiency
        self._energy_kwh = 0.0  # current stored energy

    @property
    def state_of_charge(self) -> float:
        """Return state of charge as a value in [0.0, 1.0]."""
        return self._energy_kwh / self.capacity_kwh

    def charge(self, power_kw: float, duration_h: float) -> float:
        """Charge the battery for *duration_h* hours at *power_kw* kilowatts.

        Returns the actual energy (kWh) added to the battery after losses.
        Clamps power to max_power_kw and stops when full.
        """
        if power_kw < 0:
            raise ValueError("power_kw must be non-negative for charging")
        if duration_h < 0:
            raise ValueError("duration_h must be non-negative")

        power_kw = min(power_kw, self.max_power_kw)
        energy_in = power_kw * duration_h * self.efficiency
        headroom = self.capacity_kwh - self._energy_kwh
        added = min(energy_in, headroom)
        self._energy_kwh += added
        return added

    def discharge(self, power_kw: float, duration_h: float) -> float:
        """Discharge the battery for *duration_h* hours at *power_kw* kilowatts.

        Returns the actual energy (kWh) drawn from the battery.
        Clamps power to max_power_kw and stops when empty.
        """
        if power_kw < 0:
            raise ValueError("power_kw must be non-negative for discharging")
        if duration_h < 0:
            raise ValueError("duration_h must be non-negative")

        power_kw = min(power_kw, self.max_power_kw)
        energy_requested = power_kw * duration_h
        available = self._energy_kwh * self.efficiency
        drawn = min(energy_requested, available)
        self._energy_kwh -= drawn / self.efficiency
        # Guard against floating-point drift below zero
        self._energy_kwh = max(self._energy_kwh, 0.0)
        return drawn

    def simulate_cycle(self, steps: list) -> list:
        """Run a sequence of charge/discharge steps and return the SoC history.

        Each element of *steps* must be a tuple of (power_kw, duration_h, mode)
        where *mode* is either ``"charge"`` or ``"discharge"``.

        Returns a list of floats with the state-of-charge value recorded after
        each step (including the initial SoC at index 0).
        """
        history = [self.state_of_charge]
        for power_kw, duration_h, mode in steps:
            if mode == "charge":
                self.charge(power_kw, duration_h)
            elif mode == "discharge":
                self.discharge(power_kw, duration_h)
            else:
                raise ValueError(f"Unknown mode {mode!r}; expected 'charge' or 'discharge'")
            history.append(self.state_of_charge)
        return history
