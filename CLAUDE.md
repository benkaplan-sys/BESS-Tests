# CLAUDE.md — AI Assistant Guide for BESS-Tests

## Project Overview

This repository implements a **Battery Energy Storage System (BESS)** simulator in Python. It models charge/discharge cycles with efficiency losses and state-of-charge (SoC) tracking.

- **Language:** Python 3 (no external runtime dependencies)
- **Testing:** pytest
- **Purpose:** Simulate battery behavior for energy storage scenarios

---

## Repository Structure

```
BESS-Tests/
├── bess.py          # Core BESS simulation module
├── test_bess.py     # pytest test suite (5 tests)
└── .gitignore       # Excludes __pycache__, *.pyc, .pytest_cache/
```

---

## Core Module: `bess.py`

### `BatteryEnergyStorageSystem` class

| Method / Property | Signature | Description |
|---|---|---|
| `__init__` | `(capacity_kwh, max_power_kw, efficiency=0.95)` | Constructor; validates all inputs |
| `state_of_charge` | `@property → float` | Current SoC in `[0.0, 1.0]` |
| `charge` | `(power_kw, duration_h) → float` | Charges battery; returns energy actually added (kWh) |
| `discharge` | `(power_kw, duration_h) → float` | Discharges battery; returns energy actually drawn (kWh) |
| `simulate_cycle` | `(steps: list[tuple]) → list[float]` | Runs a sequence of steps; returns full SoC history |

### Key Behaviors

- **Power clamping:** Both `charge` and `discharge` clamp `power_kw` to `max_power_kw`.
- **Efficiency losses:**
  - Charging: `energy_stored = power × duration × efficiency`
  - Discharging: `energy_drawn = min(requested, available) × efficiency`
- **SoC bounds:** SoC is clamped to `[0.0, 1.0]`; floating-point drift toward zero is explicitly guarded.
- **Input validation:** `ValueError` is raised for non-positive capacity/power, efficiency outside `(0, 1]`, and invalid step mode strings.

### `simulate_cycle` step format

```python
steps = [
    ("charge", power_kw, duration_h),
    ("discharge", power_kw, duration_h),
]
history = bess.simulate_cycle(steps)
# history[0] is initial SoC; subsequent entries are SoC after each step
```

---

## Development Workflows

### Running Tests

```bash
pytest test_bess.py
```

All 5 tests must pass before committing. There are no other build steps.

### Running the Simulator Interactively

```python
from bess import BatteryEnergyStorageSystem

bess = BatteryEnergyStorageSystem(capacity_kwh=100, max_power_kw=50)
history = bess.simulate_cycle([
    ("charge", 50, 1.0),
    ("discharge", 25, 2.0),
])
print(history)  # [0.0, 0.475, 0.0]  (example values)
```

### No Build / No Dependencies

- No `requirements.txt`, `setup.py`, or `pyproject.toml` — only `pytest` is needed for testing.
- No CI/CD pipelines are configured.

---

## Coding Conventions

- **Type hints:** All method signatures use full type annotations (`power_kw: float`, `→ float`).
- **Naming:** Descriptive names with unit suffixes where appropriate (`capacity_kwh`, `duration_h`, `max_power_kw`).
- **Private attributes:** Internal state uses underscore prefix (`_energy_kwh`).
- **Properties:** Computed/derived values are exposed as `@property`.
- **Docstrings:** Module-, class-, and method-level docstrings are required; keep them concise and factual.
- **Validation:** Validate at construction and method entry; raise `ValueError` with descriptive messages.
- **Floating-point:** Use `pytest.approx()` in tests; guard against drift explicitly in production code.
- **No over-engineering:** No abstraction layers, factories, or configurability beyond what is needed.

---

## Testing Conventions

- **Framework:** pytest
- **File:** `test_bess.py` — all tests live here; no separate test directories.
- **Coverage areas:** normal operation, boundary clamping (full/empty), error handling.
- **Assertions:** Use `pytest.approx()` for all float comparisons; use `pytest.raises()` for exception tests.
- **Test naming:** `test_simulate_cycle_<scenario>` pattern.

---

## Git Workflow

- **Default branch:** `master`
- **Active feature branches** follow the pattern `claude/<description>-<id>`.
- Commit messages are descriptive and imperative-mood (e.g., "Add BESS module and implement simulate_cycle()").
- Commit trailers include the Claude session URL.
- Keep commits focused; do not batch unrelated changes.

---

## Important Notes for AI Assistants

1. **Read files before modifying.** This is a small codebase — always read `bess.py` and `test_bess.py` before making changes.
2. **Run tests after every change.** `pytest test_bess.py` is the single source of truth.
3. **Do not add dependencies** without explicit user request. The project is intentionally dependency-free.
4. **Do not create new files** unless strictly necessary. All code belongs in `bess.py`; all tests in `test_bess.py`.
5. **Preserve existing docstrings and type hints** when editing methods.
6. **Do not add CI/CD, Makefiles, or configuration files** unless asked.
7. **Branch target:** Always develop on `claude/add-claude-documentation-fS7M2` unless instructed otherwise.
