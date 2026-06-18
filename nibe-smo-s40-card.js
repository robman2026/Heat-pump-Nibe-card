/**
 * nibe-smo-s40-card
 * Home Assistant Lovelace custom card for Nibe SMO S40 heat pump.
 * GitHub: https://github.com/robman2026/nibe-smo-s40-card
 * Version: 1.0.0
 * License: MIT
 *
 * Visual style matches robman2026/Kids-Room-Dashboard-Card:
 *   dark #0d1117 bg, circular SVG arc gauges (rotate -90deg),
 *   glow drop-shadow on arcs, uppercase sensor labels,
 *   colored icon squares, blue radial glow blob, glow-line dividers.
 *
 * Sections:
 *   - Header (title, live clock, status dot, connection badge)
 *   - Status bar (priority, compressor, connection, smart mode)
 *   - Key temperature gauges (supply, return, outdoor, discharge — 2×2 grid)
 *   - Pressures (hi/lo pressure pair tiles)
 *   - Refrigerant circuit (sensor rows)
 *   - Energy grid (produced, consumed, COP, heating kWh/h, HW kWh/h, DOT demand)
 *   - Compressor & run times (sensor rows)
 */

const _NibeLit = Object.getPrototypeOf(customElements.get("ha-panel-lovelace"));
const _NibeHtml = _NibeLit.prototype.html;
const _NibeCss  = _NibeLit.prototype.css;

// ─── Color helpers ────────────────────────────────────────────────────────────

/** Interpolate between color stops. Stops: [{pos, r, g, b}] */
function _interpColor(stops, value) {
  const clamped = Math.max(stops[0].pos, Math.min(stops[stops.length - 1].pos, value));
  let lo = stops[0], hi = stops[stops.length - 1];
  for (let i = 0; i < stops.length - 1; i++) {
    if (clamped >= stops[i].pos && clamped <= stops[i + 1].pos) {
      lo = stops[i]; hi = stops[i + 1]; break;
    }
  }
  const f = (clamped - lo.pos) / ((hi.pos - lo.pos) || 1);
  return `rgb(${Math.round(lo.r + f*(hi.r-lo.r))},${Math.round(lo.g + f*(hi.g-lo.g))},${Math.round(lo.b + f*(hi.b-lo.b))})`;
}

/** Temperature severity: blue→green→yellow→red (matches Kids Room card exactly) */
function _tempColor(v) {
  return _interpColor([
    { pos: -20, r:0x23, g:0x91, b:0xFF },
    { pos:   0, r:0x23, g:0x91, b:0xFF },
    { pos:  19, r:0x14, g:0xFF, b:0x6A },
    { pos:  27, r:0xF8, g:0xFF, b:0x42 },
    { pos:  35, r:0xFF, g:0x35, b:0x02 },
    { pos:  80, r:0xFF, g:0x35, b:0x02 },
  ], v);
}

/** Pressure color: low=amber, normal=green, high=red */
function _pressureColor(v, lo, hi) {
  if (v <= lo) return "#fbbf24";
  if (v >= hi) return "#f87171";
  return "#34d399";
}

/** arc stroke-dashoffset from value/min/max and circumference */
function _arcOffset(value, min, max, circ) {
  const pct = Math.min(1, Math.max(0, (value - min) / ((max - min) || 1)));
  return circ - pct * circ;
}

// ─── Editor ───────────────────────────────────────────────────────────────────

class NibeSmoS40CardEditor extends _NibeLit {
  static get properties() {
    return { _config: {}, _search: { state: true }, _tab: { state: true } };
  }

  constructor() {
    super();
    this._config = {};
    this._search = {};
    this._tab = "general";
  }

  setConfig(config) {
    this._config = { ...config };
  }

  // Entities helper
  _entities(...domains) {
    if (!this.hass) return [];
    return Object.keys(this.hass.states)
      .filter(e => domains.length === 0 || domains.some(d => e.startsWith(d + ".")))
      .sort();
  }

  _set(key, value) {
    this._config = { ...this._config, [key]: value === "" ? undefined : value };
    this.dispatchEvent(new CustomEvent("config-changed", { detail: { config: this._config } }));
  }

  // ── Shared UI helpers ─────────────────────────────────────────────────────

  _entitySearch(searchKey, currentValue, onChange, domains, placeholder) {
    const base     = this._entities(...(domains || []));
    const query    = (this._search[searchKey] || "").toLowerCase().trim();
    const filtered = query ? base.filter(e => e.toLowerCase().includes(query)) : base;
    const friendly = eid => {
      const fn = this.hass?.states[eid]?.attributes?.friendly_name;
      return fn ? `${fn}  (${eid})` : eid;
    };
    return _NibeHtml`
      <div class="search-wrap">
        <input class="ed-input search-input" type="text"
          placeholder="🔍 Search entities…"
          .value="${this._search[searchKey] || ""}"
          @input="${e => { this._search = { ...this._search, [searchKey]: e.target.value }; }}" />
        <select class="ed-select"
          .value="${currentValue || ""}"
          @change="${e => {
            onChange(e.target.value);
            this._search = { ...this._search, [searchKey]: "" };
          }}">
          <option value="">${placeholder || "— select entity —"}</option>
          ${filtered.slice(0, 200).map(eid => _NibeHtml`
            <option value="${eid}" ?selected="${eid === currentValue}">${friendly(eid)}</option>
          `)}
          ${filtered.length > 200 ? _NibeHtml`<option disabled>…${filtered.length - 200} more — refine search</option>` : ""}
        </select>
        ${currentValue ? _NibeHtml`<div class="selected-badge">${currentValue}</div>` : ""}
      </div>
    `;
  }

  _txt(label, value, onChange, placeholder) {
    return _NibeHtml`
      <label class="ed-label">${label}</label>
      <input class="ed-input" type="text" .value="${value || ""}" placeholder="${placeholder || ""}"
        @input="${e => onChange(e.target.value)}" />
    `;
  }

  _toggle(label, value, onChange) {
    return _NibeHtml`
      <div class="toggle-row">
        <span class="ed-label">${label}</span>
        <label class="toggle-wrap">
          <input type="checkbox" ?checked="${!!value}" @change="${e => onChange(e.target.checked)}" />
          <span class="toggle-slider"></span>
        </label>
      </div>
    `;
  }

  // ── Tabs ──────────────────────────────────────────────────────────────────

  _tabGeneral() {
    const c = this._config;
    return _NibeHtml`
      <div class="section">
        <div class="sec-title">Card identity</div>
        ${this._txt("Card Title", c.title, v => this._set("title", v), "Nibe SMO S40")}
        ${this._toggle("Show Date & Time", c.show_datetime, v => this._set("show_datetime", v))}
        ${this._toggle("Show Status Dot", c.show_status_dot, v => this._set("show_status_dot", v))}
        ${this._toggle("✨ Just HA Design", c.jha, v => this._set("jha", v))}
      </div>
      <div class="section">
        <div class="sec-title">Connection & status</div>
        <label class="ed-label">Connection State Entity</label>
        ${this._entitySearch("conn_state", c.connection_entity,
            v => this._set("connection_entity", v), ["sensor", "binary_sensor"], "— select entity —")}
        <label class="ed-label">Notifications Entity</label>
        ${this._entitySearch("notif", c.notifications_entity,
            v => this._set("notifications_entity", v), ["sensor"], "— select entity —")}
        <label class="ed-label">Smart Home Mode Entity (select.*)</label>
        ${this._entitySearch("smart_mode", c.smart_mode_entity,
            v => this._set("smart_mode_entity", v), ["select", "input_select"], "— select entity —")}
      </div>
    `;
  }

  _tabGauges() {
    const c = this._config;
    return _NibeHtml`
      <div class="section">
        <div class="sec-title">Temperature gauges</div>
        <p class="hint">Up to 4 gauges shown in a 2×2 grid. Color is automatic (blue→green→yellow→red by value).</p>

        <label class="ed-label">Gauge 1 — Supply line (calculated)</label>
        ${this._entitySearch("g1", c.gauge1_entity, v => this._set("gauge1_entity", v), ["sensor"], "— e.g. sensor.calculated_supply_climate_system_1_1708 —")}
        ${this._txt("Label 1", c.gauge1_label, v => this._set("gauge1_label", v), "Supply line")}

        <label class="ed-label">Gauge 2 — Return line</label>
        ${this._entitySearch("g2", c.gauge2_entity, v => this._set("gauge2_entity", v), ["sensor"], "— e.g. sensor.return_line_bt71_121 —")}
        ${this._txt("Label 2", c.gauge2_label, v => this._set("gauge2_label", v), "Return line")}

        <label class="ed-label">Gauge 3 — Outdoor temperature</label>
        ${this._entitySearch("g3", c.gauge3_entity, v => this._set("gauge3_entity", v), ["sensor"], "— e.g. sensor.current_outdoor_temperature_bt1_4 —")}
        ${this._txt("Label 3", c.gauge3_label, v => this._set("gauge3_label", v), "Outdoor")}

        <label class="ed-label">Gauge 4 — Discharge</label>
        ${this._entitySearch("g4", c.gauge4_entity, v => this._set("gauge4_entity", v), ["sensor"], "— e.g. sensor.ams20_10_discharge_eb101_bt14_2495 —")}
        ${this._txt("Label 4", c.gauge4_label, v => this._set("gauge4_label", v), "Discharge")}
      </div>
      <div class="section">
        <div class="sec-title">Gauge range</div>
        <p class="hint">Shared min/max for all temperature gauges (arc fill = 0% at min, 100% at max).</p>
        ${this._txt("Min °C", c.gauge_min !== undefined ? String(c.gauge_min) : "", v => this._set("gauge_min", parseFloat(v) || -20), "-20")}
        ${this._txt("Max °C", c.gauge_max !== undefined ? String(c.gauge_max) : "", v => this._set("gauge_max", parseFloat(v) || 80), "80")}
      </div>
    `;
  }

  _tabCompressor() {
    const c = this._config;
    return _NibeHtml`
      <div class="section">
        <div class="sec-title">Status bar entities</div>
        <label class="ed-label">Operating Priority Entity</label>
        ${this._entitySearch("op_prio", c.priority_entity, v => this._set("priority_entity", v), ["sensor"], "— select entity —")}
        <label class="ed-label">Compressor Status Entity</label>
        ${this._entitySearch("comp_status", c.compressor_status_entity, v => this._set("compressor_status_entity", v), ["sensor"], "— select entity —")}
        <label class="ed-label">Degree Minutes Entity</label>
        ${this._entitySearch("deg_min", c.degree_minutes_entity, v => this._set("degree_minutes_entity", v), ["sensor"], "— select entity —")}
        <label class="ed-label">Current Compressor Frequency</label>
        ${this._entitySearch("comp_freq", c.compressor_frequency_entity, v => this._set("compressor_frequency_entity", v), ["sensor"], "— select entity —")}
      </div>
      <div class="section">
        <div class="sec-title">Refrigerant circuit sensors</div>
        <p class="hint">Displayed as sensor rows below the gauges.</p>
        <label class="ed-label">Evaporator (BT16)</label>
        ${this._entitySearch("evap", c.evaporator_entity, v => this._set("evaporator_entity", v), ["sensor"], "— select entity —")}
        <label class="ed-label">Suction gas (BT17)</label>
        ${this._entitySearch("suction", c.suction_entity, v => this._set("suction_entity", v), ["sensor"], "— select entity —")}
        <label class="ed-label">Liquid line (BT15)</label>
        ${this._entitySearch("liquid", c.liquid_line_entity, v => this._set("liquid_line_entity", v), ["sensor"], "— select entity —")}
        <label class="ed-label">Condenser supply (BT12)</label>
        ${this._entitySearch("cond", c.condenser_entity, v => this._set("condenser_entity", v), ["sensor"], "— select entity —")}
        <label class="ed-label">Charge pump speed</label>
        ${this._entitySearch("pump_speed", c.charge_pump_entity, v => this._set("charge_pump_entity", v), ["sensor"], "— select entity —")}
      </div>
      <div class="section">
        <div class="sec-title">Pressures</div>
        <label class="ed-label">High pressure (BP9 dew)</label>
        ${this._entitySearch("hi_press", c.hi_pressure_entity, v => this._set("hi_pressure_entity", v), ["sensor"], "— select entity —")}
        <label class="ed-label">Low pressure (BP8 dew)</label>
        ${this._entitySearch("lo_press", c.lo_pressure_entity, v => this._set("lo_pressure_entity", v), ["sensor"], "— select entity —")}
        <label class="ed-label">Condenser pressure (BP4)</label>
        ${this._entitySearch("cond_press", c.cond_pressure_entity, v => this._set("cond_pressure_entity", v), ["sensor"], "— select entity —")}
      </div>
    `;
  }

  _tabEnergy() {
    const c = this._config;
    return _NibeHtml`
      <div class="section">
        <div class="sec-title">Energy grid</div>
        <p class="hint">6 tiles: produced, consumed, COP (auto-calculated), heating/h, hot water/h, DOT demand.</p>
        <label class="ed-label">Total production (kWh)</label>
        ${this._entitySearch("e_prod", c.energy_produced_entity, v => this._set("energy_produced_entity", v), ["sensor"], "— e.g. sensor.energy_measurement_tot_production_28392 —")}
        <label class="ed-label">Total consumption (kWh)</label>
        ${this._entitySearch("e_cons", c.energy_consumed_entity, v => this._set("energy_consumed_entity", v), ["sensor"], "— e.g. sensor.energy_measurement_tot_consumption_28393 —")}
        <label class="ed-label">Heating — energy log (kWh/h)</label>
        ${this._entitySearch("e_heat", c.energy_heating_entity, v => this._set("energy_heating_entity", v), ["sensor"], "— select entity —")}
        <label class="ed-label">Hot water — energy log (kWh/h)</label>
        ${this._entitySearch("e_hw", c.energy_hotwater_entity, v => this._set("energy_hotwater_entity", v), ["sensor"], "— select entity —")}
        <label class="ed-label">Power demand at DOT (kW)</label>
        ${this._entitySearch("e_dot", c.power_dot_entity, v => this._set("power_dot_entity", v), ["sensor"], "— e.g. sensor.power_demand_at_dot_29699 —")}
        <label class="ed-label">Current power consumption (kWh)</label>
        ${this._entitySearch("e_cur", c.power_current_entity, v => this._set("power_current_entity", v), ["sensor"], "— select entity —")}
      </div>
    `;
  }

  _tabRunTimes() {
    const c = this._config;
    return _NibeHtml`
      <div class="section">
        <div class="sec-title">Compressor run times</div>
        <label class="ed-label">Total run time (heating)</label>
        ${this._entitySearch("rt_heat", c.runtime_heating_entity, v => this._set("runtime_heating_entity", v), ["sensor"], "— select entity —")}
        <label class="ed-label">Total run time (hot water)</label>
        ${this._entitySearch("rt_hw", c.runtime_hotwater_entity, v => this._set("runtime_hotwater_entity", v), ["sensor"], "— select entity —")}
        <label class="ed-label">Total run time (cooling)</label>
        ${this._entitySearch("rt_cool", c.runtime_cooling_entity, v => this._set("runtime_cooling_entity", v), ["sensor"], "— select entity —")}
        <label class="ed-label">Number of starts</label>
        ${this._entitySearch("rt_starts", c.compressor_starts_entity, v => this._set("compressor_starts_entity", v), ["sensor"], "— select entity —")}
        <label class="ed-label">Additional heater run time</label>
        ${this._entitySearch("rt_add", c.runtime_additional_entity, v => this._set("runtime_additional_entity", v), ["sensor"], "— select entity —")}
        <label class="ed-label">Degree minutes</label>
        ${this._entitySearch("rt_dm", c.degree_minutes_entity, v => this._set("degree_minutes_entity", v), ["sensor"], "— select entity —")}
      </div>
    `;
  }

  render() {
    if (!this._config) return _NibeHtml``;
    const tabs = [
      { id: "general",    label: "General"    },
      { id: "gauges",     label: "Gauges"     },
      { id: "compressor", label: "Compressor" },
      { id: "energy",     label: "Energy"     },
      { id: "runtimes",   label: "Run times"  },
    ];
    return _NibeHtml`
      <div class="editor-root">
        <div class="tab-bar">
          ${tabs.map(t => _NibeHtml`
            <button class="tab-btn ${this._tab === t.id ? "active" : ""}"
              @click="${() => (this._tab = t.id)}">${t.label}</button>
          `)}
        </div>
        <div class="tab-content">
          ${this._tab === "general"    ? this._tabGeneral()    : ""}
          ${this._tab === "gauges"     ? this._tabGauges()     : ""}
          ${this._tab === "compressor" ? this._tabCompressor() : ""}
          ${this._tab === "energy"     ? this._tabEnergy()     : ""}
          ${this._tab === "runtimes"   ? this._tabRunTimes()   : ""}
        </div>
      </div>
    `;
  }

  static get styles() {
    return _NibeCss`
      :host { display: block; font-family: 'Segoe UI', sans-serif; }
      .editor-root { display: flex; flex-direction: column; }

      .tab-bar { display: flex; flex-wrap: wrap; border-bottom: 1px solid rgba(0,0,0,0.15); background: var(--card-background-color, #1e293b); border-radius: 8px 8px 0 0; }
      .tab-btn { flex: 1; min-width: 72px; padding: 8px 4px; font-size: 0.72rem; font-weight: 600; letter-spacing: 0.04em; border: none; background: transparent; color: var(--secondary-text-color, #94a3b8); cursor: pointer; transition: background 0.15s, color 0.15s; text-transform: uppercase; }
      .tab-btn.active { color: var(--primary-color, #3b82f6); border-bottom: 2px solid var(--primary-color, #3b82f6); background: rgba(59,130,246,0.06); }

      .tab-content { padding: 12px 4px; display: flex; flex-direction: column; gap: 4px; }

      .section { margin-bottom: 10px; }
      .sec-title { font-size: 0.8rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: var(--primary-color, #3b82f6); margin-bottom: 8px; padding-bottom: 4px; border-bottom: 1px solid rgba(59,130,246,0.2); }
      .hint { font-size: 0.73rem; color: var(--secondary-text-color, #94a3b8); margin: 0 0 8px; line-height: 1.5; }

      .ed-label { display: block; font-size: 0.72rem; font-weight: 600; color: var(--secondary-text-color, #64748b); margin-bottom: 3px; margin-top: 8px; text-transform: uppercase; letter-spacing: 0.05em; }
      .ed-input { width: 100%; padding: 7px 10px; font-size: 0.82rem; border: 1px solid var(--divider-color, #334155); border-radius: 6px; background: var(--secondary-background-color, #0f172a); color: var(--primary-text-color, #e2e8f0); box-sizing: border-box; transition: border-color 0.15s; }
      .ed-input:focus { outline: none; border-color: var(--primary-color, #3b82f6); }
      .ed-select { width: 100%; padding: 7px 10px; font-size: 0.82rem; border: 1px solid var(--divider-color, #334155); border-radius: 6px; background: var(--secondary-background-color, #0f172a); color: var(--primary-text-color, #e2e8f0); box-sizing: border-box; cursor: pointer; margin-top: 4px; }

      .search-wrap { display: flex; flex-direction: column; gap: 4px; margin-bottom: 4px; }
      .search-input { margin-bottom: 0; font-size: 0.8rem; }
      .selected-badge { font-size: 0.67rem; color: var(--primary-color, #3b82f6); background: rgba(59,130,246,0.1); border-radius: 4px; padding: 2px 6px; word-break: break-all; }

      .toggle-row { display: flex; align-items: center; justify-content: space-between; padding: 6px 0; gap: 8px; }
      .toggle-wrap { position: relative; display: inline-block; width: 40px; height: 22px; flex-shrink: 0; }
      .toggle-wrap input { display: none; }
      .toggle-slider { position: absolute; inset: 0; background: #334155; border-radius: 11px; cursor: pointer; transition: background 0.2s; }
      .toggle-slider::before { content: ""; position: absolute; left: 3px; top: 3px; width: 16px; height: 16px; background: white; border-radius: 50%; transition: transform 0.2s; }
      .toggle-wrap input:checked + .toggle-slider { background: var(--primary-color, #3b82f6); }
      .toggle-wrap input:checked + .toggle-slider::before { transform: translateX(18px); }
    `;
  }
}

// ─── Main Card ────────────────────────────────────────────────────────────────

class NibeSmoS40Card extends _NibeLit {
  static get properties() {
    return { _hass: {}, _config: {}, _ticks: { state: true } };
  }

  static getConfigElement() {
    return document.createElement("nibe-smo-s40-card-editor");
  }

  static getStubConfig() {
    return {
      title:                       "Nibe SMO S40",
      show_datetime:               true,
      show_status_dot:             true,

      // Status bar
      connection_entity:           "sensor.nibe_smo_s40_connection_state",
      notifications_entity:        "sensor.nibe_smo_s40_notifications",
      smart_mode_entity:           "select.nibe_smo_s40_smart_home_mode",
      priority_entity:             "sensor.priority_55000",
      compressor_status_entity:    "sensor.ams20_10_compressor_status_eb101_2500",
      degree_minutes_entity:       "sensor.degree_minutes_781",

      // Gauges
      gauge1_entity:               "sensor.calculated_supply_climate_system_1_1708",
      gauge1_label:                "Supply line",
      gauge2_entity:               "sensor.return_line_bt71_121",
      gauge2_label:                "Return (BT71)",
      gauge3_entity:               "sensor.current_outdoor_temperature_bt1_4",
      gauge3_label:                "Outdoor (BT1)",
      gauge4_entity:               "sensor.ams20_10_discharge_eb101_bt14_2495",
      gauge4_label:                "Discharge (BT14)",
      gauge_min:                   -20,
      gauge_max:                   80,

      // Refrigerant circuit
      evaporator_entity:           "sensor.ams20_10_evaporator_eb101_bt16_2767",
      suction_entity:              "sensor.ams20_10_suction_gas_eb101_bt17_2497",
      liquid_line_entity:          "sensor.ams20_10_liquid_line_eb101_bt15_2496",
      condenser_entity:            "sensor.ams20_10_condenser_sensor_supply_line_eb101_bt12_2494",
      charge_pump_entity:          "sensor.ams20_10_charge_pump_speed_eb101_gp12_15069",
      compressor_frequency_entity: "sensor.ams20_10_current_compressor_frequency_eb101_3096",
      hi_pressure_entity:          "sensor.ams20_10_hi_press_eb101_bp9_dew_993",
      lo_pressure_entity:          "sensor.ams20_10_low_press_eb101_bp8_dew_992",
      cond_pressure_entity:        "sensor.ams20_10_pressure_sensor_condenser_eb101_bp4_3094",

      // Energy
      energy_produced_entity:      "sensor.energy_measurement_tot_production_28392",
      energy_consumed_entity:      "sensor.energy_measurement_tot_consumption_28393",
      energy_heating_entity:       "sensor.energy_measurement_energy_log_produced_energy_for_heating_over_the_past_hour_25154",
      energy_hotwater_entity:      "sensor.energy_measurement_produced_energy_hot_water_incl_additional_heater_kwh_25134",
      power_dot_entity:            "sensor.power_demand_at_dot_29699",
      power_current_entity:        "sensor.energy_measurement_energy_log_current_power_consumption_25165",

      // Run times
      runtime_heating_entity:      "sensor.total_run_time_compressor_heating_8080",
      runtime_hotwater_entity:     "sensor.ams20_10_compressor_oper_time_hot_water_eb101_ep14_2507",
      runtime_cooling_entity:      "sensor.total_run_time_compressor_cooling_605",
      compressor_starts_entity:    "sensor.ams20_10_compressor_number_of_starts_eb101_ep14_2505",
      runtime_additional_entity:   "sensor.total_run_time_additional_heat_1755",
    };
  }

  setConfig(config) {
    this._config = {
      title:           "Nibe SMO S40",
      show_datetime:   true,
      show_status_dot: true,
      gauge_min:       -20,
      gauge_max:       80,
      ...config,
    };
  }

  set hass(hass) {
    this._hass = hass;
  }

  connectedCallback() {
    super.connectedCallback();
    this._tickInterval = setInterval(() => { this._ticks = Date.now(); }, 1000);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    clearInterval(this._tickInterval);
  }

  getCardSize() { return 10; }

  // ── State helpers ─────────────────────────────────────────────────────────

  _state(id) {
    if (!id || !this._hass) return null;
    return this._hass.states[id] || null;
  }

  _val(id) {
    const s = this._state(id);
    return s ? s.state : null;
  }

  _num(id) {
    const v = parseFloat(this._val(id));
    return isNaN(v) ? null : v;
  }

  _unit(id) {
    return this._state(id)?.attributes?.unit_of_measurement || "";
  }

  _friendly(id) {
    return this._state(id)?.attributes?.friendly_name || id;
  }

  _moreInfo(id) {
    if (!id) return;
    this.dispatchEvent(new CustomEvent("hass-more-info", {
      bubbles: true, composed: true, detail: { entityId: id },
    }));
  }

  _now() {
    const d = new Date();
    return {
      date: d.toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" }),
      time: d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
    };
  }

  // ── Render helpers ────────────────────────────────────────────────────────

  _renderGauge(entityId, label, min, max) {
    const num   = this._num(entityId);
    const unit  = this._unit(entityId) || "°C";
    const disp  = num !== null ? num.toFixed(1) : "--";
    const color = num !== null ? _tempColor(num) : "#2391FF";
    const R     = 19;
    const circ  = 2 * Math.PI * R;
    const offset = num !== null ? _arcOffset(num, min, max, circ) : circ;

    return _NibeHtml`
      <div class="gauge-tile" @click="${() => this._moreInfo(entityId)}">
        <div class="gauge-wrap">
          <svg width="50" height="50" viewBox="0 0 50 50" style="transform:rotate(-90deg);display:block">
            <circle cx="25" cy="25" r="${R}" fill="none" stroke="rgba(255,255,255,0.07)" stroke-width="3.5"/>
            <circle cx="25" cy="25" r="${R}" fill="none"
              stroke="${color}" stroke-width="3.5" stroke-linecap="round"
              stroke-dasharray="${circ.toFixed(1)}"
              stroke-dashoffset="${offset.toFixed(2)}"
              style="filter:drop-shadow(0 0 4px ${color})"/>
          </svg>
          <div class="gauge-center">
            <div class="gauge-val-sm">${disp}</div>
            <div class="gauge-unit-sm">${unit}</div>
          </div>
        </div>
        <div class="gauge-info">
          <div class="gauge-val-lg" style="color:${color}">${disp}<span class="gauge-unit-lg">${unit}</span></div>
          <div class="gauge-lbl">${label || this._friendly(entityId)}</div>
        </div>
      </div>
    `;
  }

  _renderSensorRow(entityId, icon, label, valueClass) {
    const val  = this._val(entityId);
    const unit = this._unit(entityId);
    const disp = val !== null ? `${val}${unit ? " " + unit : ""}` : "—";
    const cls  = valueClass || "c-blue";
    return _NibeHtml`
      <div class="sensor-row" @click="${() => this._moreInfo(entityId)}">
        <div class="s-icon ic-${cls.replace("c-", "")}">${icon}</div>
        <div class="s-text">
          <div class="s-name">${label || this._friendly(entityId)}</div>
        </div>
        <div class="s-val ${cls}">${disp}</div>
      </div>
    `;
  }

  _renderPressureTile(entityId, label) {
    const num  = this._num(entityId);
    const unit = this._unit(entityId) || "bar";
    const disp = num !== null ? num.toFixed(1) : "—";
    const color = num !== null ? _pressureColor(num, 2, 20) : "rgba(255,255,255,0.3)";
    return _NibeHtml`
      <div class="press-tile" @click="${() => this._moreInfo(entityId)}">
        <div>
          <div class="press-name">${label}</div>
        </div>
        <div>
          <span class="press-val" style="color:${color}">${disp}</span>
          <span class="press-unit">${unit}</span>
        </div>
      </div>
    `;
  }

  _renderEnergyTile(icon, entityId, label, color) {
    const val  = this._val(entityId);
    const unit = this._unit(entityId);
    const disp = val !== null ? Number(val).toLocaleString(undefined, { maximumFractionDigits: 2 }) : "—";
    const c = color || "#fff";
    return _NibeHtml`
      <div class="energy-tile" @click="${() => this._moreInfo(entityId)}">
        <div class="e-icon">${icon}</div>
        <div class="e-val" style="color:${c}">${disp}</div>
        <div class="e-lbl">${label}${unit ? " " + unit : ""}</div>
      </div>
    `;
  }

  // ── Main render ───────────────────────────────────────────────────────────

  render() {
    if (!this._config) return _NibeHtml``;
    const c    = this._config;
    const dt   = this._now();

    // Status bar values
    const connVal    = this._val(c.connection_entity) || "—";
    const connOnline = connVal.toLowerCase() === "connected";
    const compVal    = this._val(c.compressor_status_entity) || "—";
    const compOn     = !["off", "0", "false", "unavailable", "unknown"].includes((compVal || "").toLowerCase());
    const prioVal    = this._val(c.priority_entity) || "—";
    const dmVal      = this._val(c.degree_minutes_entity);
    const dmDisp     = dmVal !== null ? `${dmVal} DM` : "—";
    const smartVal   = this._val(c.smart_mode_entity) || "—";

    // Status dot: green if connection_entity = connected, else amber
    const dotColor = connOnline ? "#34d399" : "#fbbf24";

    // COP estimate (produced / consumed)
    const prod = this._num(c.energy_produced_entity);
    const cons = this._num(c.energy_consumed_entity);
    const cop  = (prod && cons && cons > 0) ? (prod / cons).toFixed(2) : "—";

    return _NibeHtml`
      <ha-card>
        <div class="card${this._config.jha ? ' card-jha' : ''}">

          <!-- Header -->
          <div class="header">
            <div class="title">
              <div class="title-icon">🔥</div>
              ${c.title || "Nibe SMO S40"}
            </div>
            ${c.show_datetime ? _NibeHtml`
              <div class="header-right">
                <div class="header-date">${dt.date}</div>
                <div class="header-time">${dt.time}</div>
              </div>
            ` : ""}
            ${c.show_status_dot ? _NibeHtml`
              <div class="status-dot" style="background:${dotColor};box-shadow:0 0 8px ${dotColor}80"></div>
            ` : ""}
          </div>

          <!-- Status bar -->
          <div class="status-bar" @click="${() => this._moreInfo(c.priority_entity)}">
            <div class="status-item">
              <div class="status-lbl">Priority</div>
              <div class="status-val c-blue">${prioVal}</div>
            </div>
            <div class="status-item">
              <div class="status-lbl">Compressor</div>
              <div class="status-val" style="color:${compOn ? "#34d399" : "rgba(255,255,255,0.3)"}">${compVal}</div>
            </div>
            <div class="status-item">
              <div class="status-lbl">Connection</div>
              <div class="status-val" style="color:${connOnline ? "#34d399" : "#f87171"}">${connVal}</div>
            </div>
            <div class="status-item">
              <div class="status-lbl">Deg. min</div>
              <div class="status-val c-amber">${dmDisp}</div>
            </div>
          </div>

          <!-- Smart home mode -->
          ${c.smart_mode_entity ? _NibeHtml`
            <div class="smart-mode-bar" @click="${() => this._moreInfo(c.smart_mode_entity)}">
              <span class="smart-mode-lbl">Smart Home Mode</span>
              <span class="smart-mode-val">${smartVal}</span>
            </div>
          ` : ""}

          <!-- Temperature gauges 2×2 -->
          <div class="gauges-grid">
            ${c.gauge1_entity ? this._renderGauge(c.gauge1_entity, c.gauge1_label, c.gauge_min ?? -20, c.gauge_max ?? 80) : ""}
            ${c.gauge2_entity ? this._renderGauge(c.gauge2_entity, c.gauge2_label, c.gauge_min ?? -20, c.gauge_max ?? 80) : ""}
            ${c.gauge3_entity ? this._renderGauge(c.gauge3_entity, c.gauge3_label, c.gauge_min ?? -20, c.gauge_max ?? 80) : ""}
            ${c.gauge4_entity ? this._renderGauge(c.gauge4_entity, c.gauge4_label, c.gauge_min ?? -20, c.gauge_max ?? 80) : ""}
          </div>

          <!-- Pressures -->
          ${(c.hi_pressure_entity || c.lo_pressure_entity || c.cond_pressure_entity) ? _NibeHtml`
            <div class="glow-line"></div>
            <div class="sec-lbl">Pressures</div>
            <div class="press-row">
              ${c.hi_pressure_entity  ? this._renderPressureTile(c.hi_pressure_entity,  "Hi press (BP9)")  : ""}
              ${c.lo_pressure_entity  ? this._renderPressureTile(c.lo_pressure_entity,  "Lo press (BP8)")  : ""}
              ${c.cond_pressure_entity? this._renderPressureTile(c.cond_pressure_entity,"Condenser (BP4)") : ""}
            </div>
          ` : ""}

          <!-- Refrigerant circuit -->
          <div class="glow-line"></div>
          <div class="sec-lbl">Refrigerant circuit</div>
          <div class="sensors-list">
            ${c.evaporator_entity           ? this._renderSensorRow(c.evaporator_entity,           "🌡️", "Evaporator (BT16)",        "c-blue")   : ""}
            ${c.suction_entity              ? this._renderSensorRow(c.suction_entity,              "🌡️", "Suction gas (BT17)",        "c-blue")   : ""}
            ${c.liquid_line_entity          ? this._renderSensorRow(c.liquid_line_entity,          "🌡️", "Liquid line (BT15)",        "c-blue")   : ""}
            ${c.condenser_entity            ? this._renderSensorRow(c.condenser_entity,            "🌡️", "Condenser supply (BT12)",   "c-blue")   : ""}
            ${c.compressor_frequency_entity ? this._renderSensorRow(c.compressor_frequency_entity, "⚡", "Compressor frequency",      "c-purple") : ""}
            ${c.charge_pump_entity          ? this._renderSensorRow(c.charge_pump_entity,          "💧", "Charge pump speed",         "c-purple") : ""}
          </div>

          <!-- Energy -->
          <div class="glow-line"></div>
          <div class="sec-lbl">Energy</div>
          <div class="energy-grid">
            ${c.energy_produced_entity ? this._renderEnergyTile("⚡", c.energy_produced_entity, "Produced",  "#63b3ed") : ""}
            ${c.energy_consumed_entity ? this._renderEnergyTile("🔋", c.energy_consumed_entity, "Consumed",  "#f87171") : ""}
            <div class="energy-tile">
              <div class="e-icon">📈</div>
              <div class="e-val" style="color:${cop !== "—" ? "#34d399" : "rgba(255,255,255,0.4)"}">${cop}</div>
              <div class="e-lbl">Est. COP</div>
            </div>
            ${c.energy_heating_entity  ? this._renderEnergyTile("🏠", c.energy_heating_entity,  "Heating",   "#63b3ed") : ""}
            ${c.energy_hotwater_entity ? this._renderEnergyTile("🚿", c.energy_hotwater_entity, "Hot water", "#63b3ed") : ""}
            ${c.power_dot_entity       ? this._renderEnergyTile("🔌", c.power_dot_entity,       "DOT demand","#fbbf24") : ""}
          </div>

          <!-- Run times -->
          <div class="glow-line"></div>
          <div class="sec-lbl">Compressor &amp; run times</div>
          <div class="sensors-list" style="margin-bottom:16px">
            ${c.runtime_heating_entity   ? this._renderSensorRow(c.runtime_heating_entity,   "⏱️", "Total run time — heating",    "c-blue")  : ""}
            ${c.runtime_hotwater_entity  ? this._renderSensorRow(c.runtime_hotwater_entity,  "⏱️", "Total run time — hot water",  "c-blue")  : ""}
            ${c.runtime_cooling_entity   ? this._renderSensorRow(c.runtime_cooling_entity,   "⏱️", "Total run time — cooling",    "c-blue")  : ""}
            ${c.runtime_additional_entity? this._renderSensorRow(c.runtime_additional_entity,"⏱️", "Additional heater run time",  "c-amber") : ""}
            ${c.compressor_starts_entity ? this._renderSensorRow(c.compressor_starts_entity, "🔢", "Compressor starts",           "c-blue")  : ""}
            ${c.degree_minutes_entity    ? this._renderSensorRow(c.degree_minutes_entity,    "📊", "Degree minutes",              "c-off")   : ""}
            ${c.power_current_entity     ? this._renderSensorRow(c.power_current_entity,     "⚡", "Current power consumption",   "c-green") : ""}
          </div>

        </div>
      </ha-card>
    `;
  }

  // ── Styles ────────────────────────────────────────────────────────────────

  static get styles() {
    return _NibeCss`
      :host { display: block; }

      .card {
        background: #0d1117;
        border-radius: 18px;
        overflow: hidden;
        position: relative;
        font-family: 'Segoe UI', system-ui, sans-serif;
        color: #fff;
      }
      .card::before {
        content: ''; position: absolute; top: -60px; left: -60px;
        width: 220px; height: 220px;
        background: radial-gradient(circle, rgba(99,179,237,0.08) 0%, transparent 70%);
        pointer-events: none; z-index: 0;
      }

      /* ── Header ── */
      .header { display: flex; align-items: center; justify-content: space-between; padding: 16px 20px 10px; position: relative; z-index: 1; gap: 8px; }
      .title { font-size: 16px; font-weight: 700; letter-spacing: 1.5px; text-transform: uppercase; color: #fff; display: flex; align-items: center; gap: 8px; flex: 1; min-width: 0; }
      .title-icon { width: 28px; height: 28px; border-radius: 8px; background: rgba(99,179,237,0.12); border: 1px solid rgba(99,179,237,0.2); display: flex; align-items: center; justify-content: center; font-size: 14px; flex-shrink: 0; }
      .header-right { display: flex; flex-direction: column; align-items: flex-end; gap: 1px; flex-shrink: 0; }
      .header-date { font-size: 11px; color: rgba(255,255,255,0.6); letter-spacing: 0.5px; }
      .header-time { font-size: 10px; color: rgba(255,255,255,0.35); letter-spacing: 1px; }
      .status-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; animation: pulse-dot 2s ease-in-out infinite; }
      @keyframes pulse-dot { 0%,100%{opacity:1} 50%{opacity:0.5} }

      /* ── Status bar ── */
      .status-bar { margin: 0 16px 8px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.07); border-radius: 10px; padding: 8px 0; display: flex; align-items: center; position: relative; z-index: 1; cursor: pointer; }
      .status-item { display: flex; flex-direction: column; align-items: center; gap: 2px; flex: 1; padding: 0 6px; }
      .status-item + .status-item { border-left: 1px solid rgba(255,255,255,0.05); }
      .status-lbl { font-size: 8px; letter-spacing: 1px; text-transform: uppercase; color: rgba(255,255,255,0.3); }
      .status-val { font-size: 11px; font-weight: 600; color: rgba(255,255,255,0.85); }

      /* ── Smart mode bar ── */
      .smart-mode-bar { margin: 0 16px 10px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.07); border-radius: 8px; padding: 7px 14px; display: flex; align-items: center; justify-content: space-between; cursor: pointer; position: relative; z-index: 1; }
      .smart-mode-lbl { font-size: 9px; letter-spacing: 1px; text-transform: uppercase; color: rgba(255,255,255,0.35); }
      .smart-mode-val { font-size: 12px; font-weight: 600; color: #63b3ed; }

      /* ── Gauges ── */
      .gauges-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; padding: 0 16px 12px; position: relative; z-index: 1; }
      .gauge-tile { background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); border-radius: 14px; padding: 12px 10px; display: flex; align-items: center; gap: 8px; cursor: pointer; transition: background 0.2s; min-width: 0; }
      .gauge-tile:hover { background: rgba(255,255,255,0.07); }
      .gauge-wrap { position: relative; width: 50px; height: 50px; flex-shrink: 0; }
      .gauge-center { position: absolute; top: 50%; left: 50%; transform: translate(-50%,-50%); display: flex; flex-direction: column; align-items: center; pointer-events: none; text-align: center; }
      .gauge-val-sm { font-size: 9px; font-weight: 700; color: #fff; line-height: 1; }
      .gauge-unit-sm { font-size: 6px; color: rgba(255,255,255,0.4); }
      .gauge-info { display: flex; flex-direction: column; gap: 2px; min-width: 0; flex: 1; }
      .gauge-val-lg { font-size: 17px; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; line-height: 1.1; }
      .gauge-unit-lg { font-size: 11px; font-weight: 400; margin-left: 2px; }
      .gauge-lbl { font-size: 8px; letter-spacing: 1px; color: rgba(255,255,255,0.3); text-transform: uppercase; margin-top: 3px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

      /* ── Glow line ── */
      .glow-line { height: 1px; background: linear-gradient(90deg, transparent, rgba(99,179,237,0.3), rgba(168,85,247,0.3), transparent); margin: 0 16px 10px; }

      /* ── Section label ── */
      .sec-lbl { font-size: 9px; letter-spacing: 1.5px; text-transform: uppercase; color: rgba(255,255,255,0.25); font-weight: 600; padding: 0 20px 6px; position: relative; z-index: 1; }

      /* ── Pressures ── */
      .press-row { display: flex; gap: 8px; padding: 0 16px 10px; position: relative; z-index: 1; flex-wrap: wrap; }
      .press-tile { flex: 1; min-width: 80px; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); border-radius: 12px; padding: 10px 12px; display: flex; align-items: center; justify-content: space-between; cursor: pointer; transition: background 0.2s; }
      .press-tile:hover { background: rgba(255,255,255,0.07); }
      .press-name { font-size: 9px; letter-spacing: 0.5px; color: rgba(255,255,255,0.4); }
      .press-val { font-size: 16px; font-weight: 700; }
      .press-unit { font-size: 10px; font-weight: 400; color: rgba(255,255,255,0.4); margin-left: 2px; }

      /* ── Sensor rows ── */
      .sensors-list { margin: 0 16px 10px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.07); border-radius: 14px; overflow: hidden; position: relative; z-index: 1; }
      .sensor-row { display: flex; align-items: center; padding: 9px 14px; gap: 10px; cursor: pointer; transition: background 0.15s; }
      .sensor-row + .sensor-row { border-top: 1px solid rgba(255,255,255,0.05); }
      .sensor-row:hover { background: rgba(255,255,255,0.03); }
      .s-icon { width: 30px; height: 30px; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 13px; flex-shrink: 0; }
      .ic-blue   { background: rgba(99,179,237,0.1); }
      .ic-amber  { background: rgba(251,191,36,0.12); box-shadow: 0 0 8px rgba(251,191,36,0.08); }
      .ic-green  { background: rgba(52,211,153,0.12); box-shadow: 0 0 8px rgba(52,211,153,0.08); }
      .ic-red    { background: rgba(248,113,113,0.12); }
      .ic-purple { background: rgba(168,85,247,0.12); }
      .ic-off    { background: rgba(255,255,255,0.04); }
      .s-text { flex: 1; display: flex; flex-direction: column; gap: 1px; min-width: 0; }
      .s-name { font-size: 12px; font-weight: 500; color: rgba(255,255,255,0.8); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .s-val  { font-size: 13px; font-weight: 600; flex-shrink: 0; }

      /* ── Energy grid ── */
      .energy-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin: 0 16px 10px; position: relative; z-index: 1; }
      .energy-tile { background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); border-radius: 12px; padding: 10px 8px 8px; text-align: center; cursor: pointer; transition: background 0.2s; }
      .energy-tile:hover { background: rgba(255,255,255,0.07); }
      .e-icon { font-size: 16px; margin-bottom: 4px; }
      .e-val  { font-size: 14px; font-weight: 700; color: #fff; }
      .e-lbl  { font-size: 8px; letter-spacing: 1px; text-transform: uppercase; color: rgba(255,255,255,0.3); margin-top: 2px; word-break: break-word; }

      /* ── Color classes ── */
      .c-blue   { color: #63b3ed; }
      .c-green  { color: #34d399; }
      .c-amber  { color: #fbbf24; }
      .c-red    { color: #f87171; }
      .c-purple { color: #a78bfa; }
      .c-off    { color: rgba(255,255,255,0.3); }

      /* ── Responsive ── */
      @media (max-width: 400px) {
        .gauges-grid { grid-template-columns: 1fr; }
        .energy-grid { grid-template-columns: repeat(2, 1fr); }
        .press-row   { flex-direction: column; }
      }

      /* ── Just HA Dashboard design adoption ──────────────────────────────
         Gated on --user-* tokens (defined only by the Just HA theme). Falls
         back to the card's original look on every other dashboard/theme. */
      .card-jha {
        background: var(--user-glow-amber, radial-gradient(120% 130% at 50% -10%, rgba(224,162,78,.30) 0%, rgba(160,104,43,.10) 38%, rgba(20,20,23,0) 72%)), var(--user-ink-750, #0d1117) !important;
        border: 1px solid var(--user-line, rgba(255,255,255,.09)) !important;
        border-radius: var(--user-radius-lg, 18px) !important;
      }
    `;
  }
}

// ─── Register ─────────────────────────────────────────────────────────────────

customElements.define("nibe-smo-s40-card-editor", NibeSmoS40CardEditor);
customElements.define("nibe-smo-s40-card",        NibeSmoS40Card);

window.customCards = window.customCards || [];
window.customCards.push({
  type:             "nibe-smo-s40-card",
  name:             "Nibe SMO S40 Card",
  description:      "Heat pump dashboard card for Nibe SMO S40 — temperatures, pressures, energy, run times.",
  preview:          true,
  documentationURL: "https://github.com/robman2026/nibe-smo-s40-card",
});

console.info(
  "%c NIBE-SMO-S40-CARD %c v1.0.0 ",
  "color:white;background:#3b82f6;font-weight:bold;padding:2px 4px;border-radius:3px 0 0 3px;",
  "color:#3b82f6;background:#0f172a;font-weight:bold;padding:2px 4px;border-radius:0 3px 3px 0;"
);
