# Nibe SMO S40 Card

[![HACS Custom](https://img.shields.io/badge/HACS-Custom-orange.svg)](https://github.com/hacs/integration)
[![GitHub Release](https://img.shields.io/github/release/robman2026/nibe-smo-s40-card.svg)](https://github.com/robman2026/nibe-smo-s40-card/releases)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

A Home Assistant Lovelace custom card for the **Nibe SMO S40** heat pump. Displays temperatures, pressures, refrigerant circuit data, energy statistics and compressor run times — all in a dark modern style.

---

## Features

- **Header** with live clock, status dot (green = connected, amber = disconnected)
- **Status bar** — priority, compressor state, connection, degree minutes
- **Smart Home Mode** badge (shows current mode, tappable for more info)
- **4 temperature gauges** in a 2×2 grid — animated SVG arc gauges with automatic severity color (blue → green → yellow → red)
- **Pressure tiles** — high/low/condenser pressures with auto color
- **Refrigerant circuit** sensor rows — evaporator, suction gas, liquid line, condenser, compressor frequency, charge pump speed
- **Energy grid** — produced kWh, consumed kWh, estimated COP (auto-calculated), heating, hot water, DOT demand
- **Compressor & run times** — all runtime sensors as tappable rows
- **Visual editor** with 5 tabs, searchable entity dropdowns (matching room-card style)
- Fully **responsive** — works on desktop, tablet and mobile

---

## Installation

### Via HACS (recommended)

1. Open **HACS** → **Frontend** → **⋮ menu** → **Custom repositories**
2. Add `https://github.com/robman2026/nibe-smo-s40-card` as category **Lovelace**
3. Search for **Nibe SMO S40 Card** and click **Download**
4. Reload your browser

### Manual

1. Download `nibe-smo-s40-card.js` from the latest [release](https://github.com/robman2026/nibe-smo-s40-card/releases)
2. Copy it to `config/www/nibe-smo-s40-card.js`
3. In HA: **Settings → Dashboards → Resources** → Add `/local/nibe-smo-s40-card.js` as **JavaScript module**
4. Reload your browser

---

## Usage

Add via the visual editor (search for **Nibe SMO S40 Card** in the card picker) or add manually in YAML:

```yaml
type: custom:nibe-smo-s40-card
title: Nibe SMO S40
show_datetime: true
show_status_dot: true

# Status bar
connection_entity:           sensor.nibe_smo_s40_connection_state
notifications_entity:        sensor.nibe_smo_s40_notifications
smart_mode_entity:           select.nibe_smo_s40_smart_home_mode
priority_entity:             sensor.priority_55000
compressor_status_entity:    sensor.ams20_10_compressor_status_eb101_2500
degree_minutes_entity:       sensor.degree_minutes_781

# Temperature gauges
gauge1_entity:               sensor.calculated_supply_climate_system_1_1708
gauge1_label:                Supply line
gauge2_entity:               sensor.return_line_bt71_121
gauge2_label:                Return (BT71)
gauge3_entity:               sensor.current_outdoor_temperature_bt1_4
gauge3_label:                Outdoor (BT1)
gauge4_entity:               sensor.ams20_10_discharge_eb101_bt14_2495
gauge4_label:                Discharge (BT14)
gauge_min:                   -20
gauge_max:                   80

# Pressures
hi_pressure_entity:          sensor.ams20_10_hi_press_eb101_bp9_dew_993
lo_pressure_entity:          sensor.ams20_10_low_press_eb101_bp8_dew_992
cond_pressure_entity:        sensor.ams20_10_pressure_sensor_condenser_eb101_bp4_3094

# Refrigerant circuit
evaporator_entity:           sensor.ams20_10_evaporator_eb101_bt16_2767
suction_entity:              sensor.ams20_10_suction_gas_eb101_bt17_2497
liquid_line_entity:          sensor.ams20_10_liquid_line_eb101_bt15_2496
condenser_entity:            sensor.ams20_10_condenser_sensor_supply_line_eb101_bt12_2494
compressor_frequency_entity: sensor.ams20_10_current_compressor_frequency_eb101_3096
charge_pump_entity:          sensor.ams20_10_charge_pump_speed_eb101_gp12_15069

# Energy
energy_produced_entity:      sensor.energy_measurement_tot_production_28392
energy_consumed_entity:      sensor.energy_measurement_tot_consumption_28393
energy_heating_entity:       sensor.energy_measurement_energy_log_produced_energy_for_heating_over_the_past_hour_25154
energy_hotwater_entity:      sensor.energy_measurement_produced_energy_hot_water_incl_additional_heater_kwh_25134
power_dot_entity:            sensor.power_demand_at_dot_29699
power_current_entity:        sensor.energy_measurement_energy_log_current_power_consumption_25165

# Run times
runtime_heating_entity:      sensor.total_run_time_compressor_heating_8080
runtime_hotwater_entity:     sensor.ams20_10_compressor_oper_time_hot_water_eb101_ep14_2507
runtime_cooling_entity:      sensor.total_run_time_compressor_cooling_605
compressor_starts_entity:    sensor.ams20_10_compressor_number_of_starts_eb101_ep14_2505
runtime_additional_entity:   sensor.total_run_time_additional_heat_1755
```

---

## Configuration reference

All fields are optional — configure only the sections you need.

### General

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `title` | string | `Nibe SMO S40` | Card title shown in header |
| `show_datetime` | bool | `true` | Show live date and time in header |
| `show_status_dot` | bool | `true` | Show green/amber status dot in header |

### Status bar

| Key | Type | Description |
|-----|------|-------------|
| `connection_entity` | entity | Connection state sensor |
| `notifications_entity` | entity | Notifications count sensor |
| `smart_mode_entity` | entity | Smart Home Mode select entity |
| `priority_entity` | entity | Operating priority sensor |
| `compressor_status_entity` | entity | Compressor on/off status |
| `degree_minutes_entity` | entity | Degree minutes sensor |

### Temperature gauges

| Key | Type | Description |
|-----|------|-------------|
| `gauge1_entity` … `gauge4_entity` | entity | Sensor entities for the 4 gauges |
| `gauge1_label` … `gauge4_label` | string | Labels for each gauge |
| `gauge_min` | number | Arc min value (default `-20`) |
| `gauge_max` | number | Arc max value (default `80`) |

### Pressures

| Key | Description |
|-----|-------------|
| `hi_pressure_entity` | High pressure (BP9 dew) |
| `lo_pressure_entity` | Low pressure (BP8 dew) |
| `cond_pressure_entity` | Condenser pressure (BP4) |

### Refrigerant circuit

| Key | Description |
|-----|-------------|
| `evaporator_entity` | Evaporator temperature (BT16) |
| `suction_entity` | Suction gas temperature (BT17) |
| `liquid_line_entity` | Liquid line temperature (BT15) |
| `condenser_entity` | Condenser supply temperature (BT12) |
| `compressor_frequency_entity` | Current compressor frequency |
| `charge_pump_entity` | Charge pump speed (GP12) |

### Energy

| Key | Description |
|-----|-------------|
| `energy_produced_entity` | Total production kWh |
| `energy_consumed_entity` | Total consumption kWh |
| `energy_heating_entity` | Heating — energy log kWh/h |
| `energy_hotwater_entity` | Hot water — energy log kWh/h |
| `power_dot_entity` | Power demand at DOT (kW) |
| `power_current_entity` | Current power consumption |

> COP is calculated automatically as `produced / consumed`. No entity needed.

### Run times

| Key | Description |
|-----|-------------|
| `runtime_heating_entity` | Compressor run time — heating |
| `runtime_hotwater_entity` | Compressor run time — hot water |
| `runtime_cooling_entity` | Compressor run time — cooling |
| `compressor_starts_entity` | Number of compressor starts |
| `runtime_additional_entity` | Additional heater run time |

---

## Compatibility

| Home Assistant | Tested |
|---------------|--------|
| 2024.x | ✅ |
| 2025.x | ✅ |

Requires the [Nibe SMO integration](https://www.home-assistant.io/integrations/nibe_heatpump/) or equivalent.

---

## License

MIT — see [LICENSE](LICENSE)

## Author

[@robman2026](https://github.com/robman2026)
