/**
 * Excel template generator and parser for BESS ERCOT simulation inputs.
 *
 * Sheets:
 *  1. Instructions  — overview and field descriptions
 *  2. Settings      — seed, trials, start year, momentum
 *  3. Seasons       — month → summer | other mapping
 *  4. Distributions — 10 years × [mu_normal, sigma_normal, mu_high, sigma_high]
 *  5. Summer_Transitions — 10 years × [NH_D1…D10, HN_D1…D10]
 *  6. Other_Transitions  — same structure for other-season months
 */

import * as XLSX from 'xlsx';
import {
  SimulationConfig,
  flatProbs,
  TRANSITION_DURATION_STEPS,
  DEFAULT_SEASON_DEFINITION,
} from './types';
import { migrateConfig } from './migration';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type Row = (string | number | boolean | null)[];

function sheetFromRows(rows: Row[]): XLSX.WorkSheet {
  return XLSX.utils.aoa_to_sheet(rows);
}

function setColWidths(ws: XLSX.WorkSheet, widths: number[]): void {
  ws['!cols'] = widths.map((w) => ({ wch: w }));
}

const MONTH_NAMES = [
  '', 'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

// ---------------------------------------------------------------------------
// Sheet builders
// ---------------------------------------------------------------------------

function buildInstructions(): XLSX.WorkSheet {
  const rows: Row[] = [
    ['BESS ERCOT Revenue Forecasting Model — Input Template'],
    [''],
    ['HOW TO USE THIS TEMPLATE'],
    ['1. Fill in each sheet (Settings, Seasons, Distributions, Summer_Transitions, Other_Transitions).'],
    ['2. Do NOT rename sheets or move header rows — the parser depends on fixed positions.'],
    ['3. Save as .xlsx and upload using the "Import from Excel" button in the tool.'],
    [''],
    ['SHEET DESCRIPTIONS'],
    ['Settings',           'Simulation-level parameters (seed, trials, start year, scenario divergence).'],
    ['Seasons',            'Assign each of the 12 calendar months to "summer" or "other". At least 1 of each required.'],
    ['Distributions',      'Log-normal revenue parameters (μ, σ) for normal and high-revenue days per year.'],
    ['Summer_Transitions', 'Duration-dependent transition probabilities for summer months (D1–D10 per year).'],
    ['Other_Transitions',  'Duration-dependent transition probabilities for other months (D1–D10 per year).'],
    [''],
    ['REVENUE DISTRIBUTIONS (log-space parameters)'],
    ['μ (mu)',    'Log-space mean of daily revenue. Typical range: 9–13. exp(μ) ≈ median daily revenue in $/day.'],
    ['σ (sigma)', 'Log-space std dev. Must be > 0. Typical range: 0.2–0.8. Higher σ = wider daily spread.'],
    [''],
    ['TRANSITION PROBABILITIES'],
    ['D1…D10', 'Probability of switching regime given 1, 2, … consecutive days in the current regime.'],
    ['        ', 'D10 applies to all subsequent days (10+). All values must be strictly between 0 and 1.'],
    ['N→H', 'Probability of Normal → High transition (low = mostly normal days, e.g. 0.02–0.10).'],
    ['H→N', 'Probability of High → Normal transition (high = short high-day runs, e.g. 0.20–0.50).'],
    [''],
    ['PATH-DEPENDENT MOMENTUM (Annual Drift Accumulation)'],
    ['Enabled',     'TRUE/FALSE. Each year\'s log-revenue deviation from baseline compounds permanently into future years.'],
    ['Drift Scale', '0–1. Fraction of each year\'s log-revenue deviation added to the cumulative drift. 0.10–0.25 recommended.'],
  ];
  const ws = sheetFromRows(rows);
  setColWidths(ws, [22, 80]);
  return ws;
}

function buildSettings(config: SimulationConfig): XLSX.WorkSheet {
  const rows: Row[] = [
    ['Parameter', 'Value', 'Description / Valid Range'],
    ['Seed',        config.baseSeed,    'Integer 0 – 4,294,967,295. Same seed + config → identical results.'],
    ['Trials',      config.numTrials,   'Integer 100 – 10,000. More trials = smoother percentiles.'],
    ['Start Year',  config.startYear,   'Integer 2020 – 2060. Calendar label for Year 1 (display only).'],
    ['Momentum Enabled', config.momentum.enabled ? 'TRUE' : 'FALSE',
      'TRUE or FALSE. Annual drift accumulation — high-revenue trials stay high, low stay low, no reversion.'],
    ['Drift Scale', config.momentum.pathWeight,
      '0 – 1. Fraction of annual log-revenue deviation compounded into future years. 0.10–0.25 recommended.'],
  ];
  const ws = sheetFromRows(rows);
  setColWidths(ws, [28, 14, 65]);
  return ws;
}

function buildSeasons(config: SimulationConfig): XLSX.WorkSheet {
  const rows: Row[] = [
    ['Month #', 'Month Name', 'Season', 'Valid values: summer | other'],
    ...Array.from({ length: 12 }, (_, i) => {
      const m = i + 1;
      return [m, MONTH_NAMES[m]!, config.seasonDefinition[m] ?? 'other'];
    }),
  ];
  const ws = sheetFromRows(rows);
  setColWidths(ws, [9, 14, 10, 30]);
  return ws;
}

function buildDistributions(config: SimulationConfig): XLSX.WorkSheet {
  const headers: Row = [
    'Year', 'Cal. Year',
    'μ Normal', 'σ Normal',
    'μ High', 'σ High',
  ];
  const rows: Row[] = [
    headers,
    ['', '', '(log-space mean)', '(log-space σ, >0)', '(log-space mean)', '(log-space σ, >0)'],
    ...config.years.map((y) => [
      y.year,
      config.startYear + y.year - 1,
      y.normal.mu,
      y.normal.sigma,
      y.high.mu,
      y.high.sigma,
    ]),
  ];
  const ws = sheetFromRows(rows);
  setColWidths(ws, [6, 10, 14, 12, 14, 12]);
  return ws;
}

function buildTransitions(config: SimulationConfig, season: 'summer' | 'other'): XLSX.WorkSheet {
  const d = (n: number) => (n < TRANSITION_DURATION_STEPS ? `D${n + 1}` : 'D10+');
  const dHeaders = Array.from({ length: TRANSITION_DURATION_STEPS }, (_, i) => d(i));

  const headers: Row = [
    'Year', 'Cal. Year',
    ...dHeaders.map((h) => `N→H ${h}`),
    ...dHeaders.map((h) => `H→N ${h}`),
  ];
  const subHeaders: Row = [
    '', '',
    ...Array(TRANSITION_DURATION_STEPS).fill('P(Normal→High)'),
    ...Array(TRANSITION_DURATION_STEPS).fill('P(High→Normal)'),
  ];

  const rows: Row[] = [
    headers,
    subHeaders,
    ...config.years.map((y) => {
      const matrix = season === 'summer' ? y.summer : y.other;
      return [
        y.year,
        config.startYear + y.year - 1,
        ...matrix.pNormalToHigh,
        ...matrix.pHighToNormal,
      ];
    }),
  ];
  const ws = sheetFromRows(rows);
  // Year + CalYear + 10 NH + 10 HN = 22 columns
  setColWidths(ws, [6, 10, ...Array(20).fill(7)]);
  return ws;
}

// ---------------------------------------------------------------------------
// Public: Generate workbook
// ---------------------------------------------------------------------------

/**
 * Generate an XLSX workbook pre-populated with the given config.
 * Returns the workbook as a binary string (XLSX.write with type:'binary').
 */
export function generateExcelTemplate(config: SimulationConfig): Uint8Array {
  const wb = XLSX.utils.book_new();

  XLSX.utils.book_append_sheet(wb, buildInstructions(), 'Instructions');
  XLSX.utils.book_append_sheet(wb, buildSettings(config), 'Settings');
  XLSX.utils.book_append_sheet(wb, buildSeasons(config), 'Seasons');
  XLSX.utils.book_append_sheet(wb, buildDistributions(config), 'Distributions');
  XLSX.utils.book_append_sheet(wb, buildTransitions(config, 'summer'), 'Summer_Transitions');
  XLSX.utils.book_append_sheet(wb, buildTransitions(config, 'other'), 'Other_Transitions');

  return XLSX.write(wb, { bookType: 'xlsx', type: 'array' }) as Uint8Array;
}

/**
 * Download the Excel template as a file in the browser.
 */
export function downloadExcelTemplate(config: SimulationConfig, filename?: string): void {
  const data = generateExcelTemplate(config);
  const blob = new Blob([data.buffer as ArrayBuffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename ?? `bess-inputs-${new Date().toISOString().slice(0, 10)}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}

// ---------------------------------------------------------------------------
// Public: Parse uploaded workbook
// ---------------------------------------------------------------------------

export interface ParseResult {
  config: SimulationConfig | null;
  errors: string[];
  warnings: string[];
}

function cellStr(ws: XLSX.WorkSheet, row: number, col: number): string {
  const addr = XLSX.utils.encode_cell({ r: row, c: col });
  const cell = ws[addr];
  if (!cell) return '';
  return String(cell.v ?? '').trim();
}

function cellNum(ws: XLSX.WorkSheet, row: number, col: number): number | null {
  const addr = XLSX.utils.encode_cell({ r: row, c: col });
  const cell = ws[addr];
  if (!cell) return null;
  const v = Number(cell.v);
  return isFinite(v) ? v : null;
}

function cellBool(ws: XLSX.WorkSheet, row: number, col: number): boolean | null {
  const addr = XLSX.utils.encode_cell({ r: row, c: col });
  const cell = ws[addr];
  if (!cell) return null;
  if (typeof cell.v === 'boolean') return cell.v;
  const s = String(cell.v).trim().toUpperCase();
  if (s === 'TRUE' || s === '1') return true;
  if (s === 'FALSE' || s === '0') return false;
  return null;
}

/**
 * Parse an uploaded XLSX file (ArrayBuffer) into a SimulationConfig.
 * Returns errors for critical problems and warnings for non-fatal issues.
 */
export function parseExcelTemplate(buffer: ArrayBuffer): ParseResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  let wb: XLSX.WorkBook;
  try {
    wb = XLSX.read(buffer, { type: 'array' });
  } catch {
    return { config: null, errors: ['Could not read file. Make sure it is a valid .xlsx file.'], warnings: [] };
  }

  const required = ['Settings', 'Seasons', 'Distributions', 'Summer_Transitions', 'Other_Transitions'];
  for (const name of required) {
    if (!wb.Sheets[name]) errors.push(`Missing sheet: "${name}"`);
  }
  if (errors.length > 0) return { config: null, errors, warnings };

  // ---- Settings (rows 1-5, 0-indexed) ----
  const sWs = wb.Sheets['Settings']!;
  const baseSeed      = cellNum(sWs, 1, 1) ?? 42;
  const numTrials     = cellNum(sWs, 2, 1) ?? 1000;
  const startYear     = cellNum(sWs, 3, 1) ?? 2025;
  const momEnabled    = cellBool(sWs, 4, 1) ?? false;
  const momPathWeight = cellNum(sWs, 5, 1) ?? 0.20;

  if (!Number.isInteger(baseSeed) || baseSeed < 0 || baseSeed > 4294967295)
    errors.push(`Settings: Seed must be an integer 0–4,294,967,295 (got ${baseSeed})`);
  if (!Number.isInteger(numTrials) || numTrials < 100 || numTrials > 10000)
    errors.push(`Settings: Trials must be an integer 100–10,000 (got ${numTrials})`);
  if (!Number.isInteger(startYear) || startYear < 2020 || startYear > 2060)
    errors.push(`Settings: Start Year must be 2020–2060 (got ${startYear})`);
  if (!isFinite(momPathWeight) || momPathWeight < 0 || momPathWeight > 1)
    errors.push(`Settings: Drift Scale must be 0–1 (got ${momPathWeight})`);

  // ---- Seasons (rows 1-12) ----
  const seasonWs = wb.Sheets['Seasons']!;
  const seasonDefinition: SimulationConfig['seasonDefinition'] = { ...DEFAULT_SEASON_DEFINITION };
  for (let i = 0; i < 12; i++) {
    const month = i + 1;
    const val = cellStr(seasonWs, i + 1, 2).toLowerCase();
    if (val !== 'summer' && val !== 'other') {
      errors.push(`Seasons: Month ${month} (${MONTH_NAMES[month]}) must be "summer" or "other" (got "${val}")`);
    } else {
      seasonDefinition[month] = val;
    }
  }

  // ---- Distributions (rows 2-11, skip 2-row header) ----
  const distWs = wb.Sheets['Distributions']!;
  const years: SimulationConfig['years'] = [];

  for (let i = 0; i < 10; i++) {
    const row = i + 2; // rows 0=header, 1=subheader, 2-11=data
    const muN  = cellNum(distWs, row, 2);
    const sigN = cellNum(distWs, row, 3);
    const muH  = cellNum(distWs, row, 4);
    const sigH = cellNum(distWs, row, 5);

    if (muN === null)  errors.push(`Distributions: Year ${i + 1} μ Normal is missing`);
    if (sigN === null || sigN <= 0) errors.push(`Distributions: Year ${i + 1} σ Normal must be > 0 (got ${sigN})`);
    if (muH === null)  errors.push(`Distributions: Year ${i + 1} μ High is missing`);
    if (sigH === null || sigH <= 0) errors.push(`Distributions: Year ${i + 1} σ High must be > 0 (got ${sigH})`);

    years.push({
      year: i + 1,
      normal: { mu: muN ?? 10.5, sigma: sigN && sigN > 0 ? sigN : 0.4 },
      high:   { mu: muH ?? 12.0, sigma: sigH && sigH > 0 ? sigH : 0.6 },
      summer: { pNormalToHigh: flatProbs(0.05), pHighToNormal: flatProbs(0.3) },
      other:  { pNormalToHigh: flatProbs(0.02), pHighToNormal: flatProbs(0.4) },
    });
  }

  // ---- Transition probabilities (helper) ----
  const parseTransitions = (wsName: string, season: 'summer' | 'other') => {
    const tWs = wb.Sheets[wsName];
    if (!tWs) return;

    for (let i = 0; i < 10; i++) {
      const row = i + 2; // rows 0=header, 1=subheader, 2-11=data
      const nhProbs: number[] = [];
      const hnProbs: number[] = [];

      for (let d = 0; d < TRANSITION_DURATION_STEPS; d++) {
        const nhCol = 2 + d;
        const hnCol = 2 + TRANSITION_DURATION_STEPS + d;

        const nh = cellNum(tWs, row, nhCol);
        const hn = cellNum(tWs, row, hnCol);

        if (nh === null || nh <= 0 || nh >= 1) {
          errors.push(`${wsName}: Year ${i + 1} N→H D${d + 1} must be (0,1) (got ${nh})`);
          nhProbs.push(0.05);
        } else {
          nhProbs.push(nh);
        }

        if (hn === null || hn <= 0 || hn >= 1) {
          errors.push(`${wsName}: Year ${i + 1} H→N D${d + 1} must be (0,1) (got ${hn})`);
          hnProbs.push(0.3);
        } else {
          hnProbs.push(hn);
        }
      }

      const yr = years[i];
      if (yr) {
        yr[season] = { pNormalToHigh: nhProbs, pHighToNormal: hnProbs };
      }
    }
  };

  parseTransitions('Summer_Transitions', 'summer');
  parseTransitions('Other_Transitions', 'other');

  if (errors.length > 0) return { config: null, errors, warnings };

  const rawConfig = {
    baseSeed: Math.round(baseSeed),
    numTrials: Math.round(numTrials),
    startYear: Math.round(startYear),
    seasonDefinition,
    years,
    momentum: { enabled: momEnabled, pathWeight: momPathWeight },
  };

  return { config: migrateConfig(rawConfig), errors: [], warnings };
}
