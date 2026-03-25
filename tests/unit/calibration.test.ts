import { describe, it, expect } from 'vitest';
import {
  parseBackcastCSV,
  computePercentileThreshold,
  classifyRegimes,
  computeAnnualStats,
  computeTransitionHazards,
  detectSeasonality,
  generateForwardParams,
  DEFAULT_CALIBRATION_OPTIONS,
} from '@/core/calibration';
import type { DailyRecord, ClassifiedRecord } from '@/core/calibration';

// ---------------------------------------------------------------------------
// parseBackcastCSV
// ---------------------------------------------------------------------------
describe('parseBackcastCSV', () => {
  it('parses a well-formed CSV with header', () => {
    const csv = [
      'Date,Revenue (USD/MW-day)',
      '2020-01-01,100',
      '2020-01-02,200',
      '2020-01-03,150',
    ].join('\n');

    const records = parseBackcastCSV(csv);
    expect(records).toHaveLength(3);
    expect(records[0]!.revenue).toBe(100);
    expect(records[0]!.month).toBe(1);
    expect(records[0]!.year).toBe(2020);
  });

  it('skips rows with unparseable dates', () => {
    const csv = [
      'Date,Revenue (USD/MW-day)',
      'not-a-date,100',
      '2020-06-15,250',
    ].join('\n');

    const records = parseBackcastCSV(csv);
    expect(records).toHaveLength(1);
    expect(records[0]!.revenue).toBe(250);
  });

  it('skips rows with non-positive revenue', () => {
    const csv = [
      'Date,Revenue (USD/MW-day)',
      '2020-01-01,-10',
      '2020-01-02,0',
      '2020-01-03,50',
    ].join('\n');

    const records = parseBackcastCSV(csv);
    expect(records).toHaveLength(1);
    expect(records[0]!.revenue).toBe(50);
  });

  it('returns records sorted ascending by date', () => {
    const csv = [
      'Date,Revenue (USD/MW-day)',
      '2020-03-01,300',
      '2020-01-01,100',
      '2020-02-01,200',
    ].join('\n');

    const records = parseBackcastCSV(csv);
    expect(records[0]!.revenue).toBe(100);
    expect(records[1]!.revenue).toBe(200);
    expect(records[2]!.revenue).toBe(300);
  });

  it('handles CRLF line endings', () => {
    const csv = 'Date,Revenue (USD/MW-day)\r\n2020-01-01,50\r\n2020-01-02,75\r\n';
    const records = parseBackcastCSV(csv);
    expect(records).toHaveLength(2);
  });

  it('returns empty array for empty input', () => {
    expect(parseBackcastCSV('')).toHaveLength(0);
    expect(parseBackcastCSV('Date,Revenue (USD/MW-day)')).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// computePercentileThreshold
// ---------------------------------------------------------------------------
describe('computePercentileThreshold', () => {
  function makeRecords(revenues: number[]): DailyRecord[] {
    return revenues.map((revenue, i) => ({
      date: new Date(2020, 0, i + 1),
      revenue,
      year: 2020,
      month: 1,
    }));
  }

  it('P50 of [10,20,30,40,50] returns 30', () => {
    const records = makeRecords([10, 20, 30, 40, 50]);
    expect(computePercentileThreshold(records, 0.5)).toBe(30);
  });

  it('P0 returns minimum value', () => {
    const records = makeRecords([10, 20, 30, 40, 50]);
    expect(computePercentileThreshold(records, 0)).toBe(10);
  });

  it('P100 returns maximum value', () => {
    const records = makeRecords([10, 20, 30, 40, 50]);
    expect(computePercentileThreshold(records, 1)).toBe(50);
  });

  it('returns 0 for empty records', () => {
    expect(computePercentileThreshold([], 0.75)).toBe(0);
  });

  it('P75 of [10,20,30,40,50] returns 40', () => {
    const records = makeRecords([10, 20, 30, 40, 50]);
    expect(computePercentileThreshold(records, 0.75)).toBe(40);
  });
});

// ---------------------------------------------------------------------------
// classifyRegimes
// ---------------------------------------------------------------------------
describe('classifyRegimes', () => {
  function makeRecords(revenues: number[]): DailyRecord[] {
    return revenues.map((revenue, i) => ({
      date: new Date(2020, 0, i + 1),
      revenue,
      year: 2020,
      month: 1,
    }));
  }

  it('classifies all values at or above threshold as high', () => {
    const records = makeRecords([50, 100, 150, 200]);
    const classified = classifyRegimes(records, 100);
    expect(classified[0]!.regime).toBe('normal'); // 50 < 100
    expect(classified[1]!.regime).toBe('high');   // 100 >= 100
    expect(classified[2]!.regime).toBe('high');   // 150 >= 100
    expect(classified[3]!.regime).toBe('high');   // 200 >= 100
  });

  it('classifies all below threshold as normal', () => {
    const records = makeRecords([10, 20, 30]);
    const classified = classifyRegimes(records, 100);
    for (const r of classified) {
      expect(r.regime).toBe('normal');
    }
  });

  it('preserves original record fields', () => {
    const records = makeRecords([50]);
    const classified = classifyRegimes(records, 75);
    expect(classified[0]!.revenue).toBe(50);
    expect(classified[0]!.year).toBe(2020);
  });
});

// ---------------------------------------------------------------------------
// computeAnnualStats
// ---------------------------------------------------------------------------
describe('computeAnnualStats', () => {
  function makeClassified(revenues: number[], regime: 'normal' | 'high', year: number): ClassifiedRecord[] {
    return revenues.map((revenue, i) => ({
      date: new Date(year, i % 12, 1),
      revenue,
      year,
      month: (i % 12) + 1,
      regime,
    }));
  }

  it('produces one entry per year', () => {
    const records = [
      ...makeClassified([100, 110, 90], 'normal', 2020),
      ...makeClassified([200, 220], 'high', 2020),
      ...makeClassified([105, 95], 'normal', 2021),
    ];
    const stats = computeAnnualStats(records);
    expect(stats).toHaveLength(2);
    expect(stats[0]!.calYear).toBe(2020);
    expect(stats[1]!.calYear).toBe(2021);
  });

  it('computes correct log-normal mu for normal regime', () => {
    // Use exp(1) ~ 2.718 values so log values are 1.0
    const val = Math.exp(1);
    const records = makeClassified([val, val, val, val, val], 'normal', 2020);
    const stats = computeAnnualStats(records);
    expect(stats[0]!.normalLogMean).toBeCloseTo(1.0, 4);
    expect(stats[0]!.normalLogSd).toBeCloseTo(0.01, 2); // near zero, floored to 0.01
  });

  it('falls back to normal params for high when fewer than 5 high days', () => {
    const normalRecords = makeClassified([100, 110, 90, 95, 105, 108, 92], 'normal', 2020);
    const highRecords = makeClassified([300, 350, 320], 'high', 2020); // only 3 high
    const stats = computeAnnualStats([...normalRecords, ...highRecords]);
    // High mu should equal normal mu (fallback)
    expect(stats[0]!.highLogMean).toBeCloseTo(stats[0]!.normalLogMean, 4);
  });

  it('computes correct highFraction', () => {
    const normalRecords = makeClassified(Array(7).fill(100) as number[], 'normal', 2020);
    const highRecords = makeClassified(Array(3).fill(300) as number[], 'high', 2020);
    const stats = computeAnnualStats([...normalRecords, ...highRecords]);
    expect(stats[0]!.highFraction).toBeCloseTo(0.3, 4);
  });

  it('computes normalDollarMean ~ exp(mu + 0.5*sigma^2)', () => {
    const val = Math.exp(2); // log(val) = 2
    const records = makeClassified(Array(10).fill(val) as number[], 'normal', 2020);
    const stats = computeAnnualStats(records);
    // sigma is near 0, so dollar mean ~ exp(2 + 0) = exp(2)
    expect(stats[0]!.normalDollarMean).toBeCloseTo(Math.exp(2), 1);
  });
});

// ---------------------------------------------------------------------------
// computeTransitionHazards
// ---------------------------------------------------------------------------
describe('computeTransitionHazards', () => {
  function makeClassifiedSeq(regimes: ('normal' | 'high')[]): ClassifiedRecord[] {
    return regimes.map((regime, i) => ({
      date: new Date(2020, 0, i + 1),
      revenue: regime === 'normal' ? 50 : 200,
      year: 2020,
      month: 1,
      regime,
    }));
  }

  it('returns arrays of length 10', () => {
    const records = makeClassifiedSeq(['normal', 'high', 'normal', 'high']);
    const { nToH, hToN } = computeTransitionHazards(records);
    expect(nToH).toHaveLength(10);
    expect(hToN).toHaveLength(10);
  });

  it('all hazards are in [0.003, 0.95]', () => {
    const records = makeClassifiedSeq([
      'normal', 'normal', 'normal', 'high', 'high',
      'normal', 'normal', 'high', 'high', 'high',
      'normal', 'high', 'normal', 'normal', 'high',
    ]);
    const { nToH, hToN } = computeTransitionHazards(records);
    for (const v of [...nToH, ...hToN]) {
      expect(v).toBeGreaterThanOrEqual(0.003);
      expect(v).toBeLessThanOrEqual(0.95);
    }
  });

  it('alternating N/H sequence produces duration-1 transitions', () => {
    // With single-day runs, the event always happens at bin 0
    const records = makeClassifiedSeq([
      'normal', 'high', 'normal', 'high', 'normal', 'high',
      'normal', 'high', 'normal', 'high', 'normal', 'high',
      'normal', 'high', 'normal', 'high', 'normal', 'high',
      'normal', 'high', 'normal', 'high', 'normal', 'high',
    ]);
    const { nToH, hToN } = computeTransitionHazards(records);
    // Duration-1 bin should have highest hazard (or at least be non-trivial)
    // With enough data, hazard at index 0 should be significant
    expect(nToH[0]).toBeGreaterThan(0.003);
    expect(hToN[0]).toBeGreaterThan(0.003);
  });

  it('returns floor values for insufficient data', () => {
    const records = makeClassifiedSeq(['normal', 'high']);
    const { nToH, hToN } = computeTransitionHazards(records);
    // With very few transitions, at_risk < 10 everywhere, so floor 0.05 applies
    for (const v of [...nToH, ...hToN]) {
      expect(v).toBeGreaterThanOrEqual(0.003);
    }
  });
});

// ---------------------------------------------------------------------------
// detectSeasonality
// ---------------------------------------------------------------------------
describe('detectSeasonality', () => {
  function makeMonthlyRecords(monthRevenues: Record<number, number[]>): DailyRecord[] {
    const records: DailyRecord[] = [];
    for (const [monthStr, revs] of Object.entries(monthRevenues)) {
      const month = parseInt(monthStr, 10);
      for (let i = 0; i < revs.length; i++) {
        records.push({
          date: new Date(2020, month - 1, i + 1),
          revenue: revs[i]!,
          year: 2020,
          month,
        });
      }
    }
    return records;
  }

  it('marks top 4 months by mean revenue as summer', () => {
    const records = makeMonthlyRecords({
      1: [10], 2: [10], 3: [10], 4: [10], 5: [10], 6: [10],
      7: [500], 8: [400], 9: [300], 10: [200], 11: [10], 12: [10],
    });
    const def = detectSeasonality(records);
    // Jul(7), Aug(8), Sep(9), Oct(10) should be summer (top 4 by mean)
    expect(def[7]).toBe('summer');
    expect(def[8]).toBe('summer');
    expect(def[9]).toBe('summer');
    expect(def[10]).toBe('summer');
    expect(def[1]).toBe('other');
    expect(def[6]).toBe('other');
  });

  it('returns SeasonDefinition with all 12 months', () => {
    const records = makeMonthlyRecords({
      1: [100], 2: [100], 3: [100], 4: [100], 5: [100], 6: [100],
      7: [100], 8: [100], 9: [100], 10: [100], 11: [100], 12: [100],
    });
    const def = detectSeasonality(records);
    for (let m = 1; m <= 12; m++) {
      expect(def[m]).toBeDefined();
    }
  });

  it('ERCOT pattern: Jun/Jul/Aug/Sep should be summer', () => {
    // Simulate ERCOT pattern where summer months have high revenues
    const records = makeMonthlyRecords({
      1: [80],  2: [75],  3: [85],  4: [90],  5: [100],
      6: [350], 7: [400], 8: [380], 9: [320],
      10: [100], 11: [85], 12: [80],
    });
    const def = detectSeasonality(records);
    expect(def[6]).toBe('summer'); // Jun
    expect(def[7]).toBe('summer'); // Jul
    expect(def[8]).toBe('summer'); // Aug
    expect(def[9]).toBe('summer'); // Sep
  });
});

// ---------------------------------------------------------------------------
// generateForwardParams
// ---------------------------------------------------------------------------
describe('generateForwardParams', () => {
  const mockAnnualStats = [
    {
      calYear: 2020,
      normalCount: 280,
      highCount: 85,
      highFraction: 0.23,
      normalLogMean: 4.0,
      normalLogSd: 0.3,
      highLogMean: 5.5,
      highLogSd: 0.4,
      normalDollarMean: Math.exp(4.0 + 0.5 * 0.09),
      highDollarMean: Math.exp(5.5 + 0.5 * 0.16),
      totalDollarMean: 100,
    },
    {
      calYear: 2021,
      normalCount: 285,
      highCount: 80,
      highFraction: 0.22,
      normalLogMean: 4.1,
      normalLogSd: 0.31,
      highLogMean: 5.6,
      highLogSd: 0.41,
      normalDollarMean: Math.exp(4.1 + 0.5 * 0.0961),
      highDollarMean: Math.exp(5.6 + 0.5 * 0.1681),
      totalDollarMean: 110,
    },
  ];

  const dummyHazards = {
    nToH: Array(10).fill(0.05) as number[],
    hToN: Array(10).fill(0.3) as number[],
  };

  const dummySeasonDef = {
    1: 'other' as const, 2: 'other' as const, 3: 'other' as const,
    4: 'other' as const, 5: 'other' as const, 6: 'summer' as const,
    7: 'summer' as const, 8: 'summer' as const, 9: 'summer' as const,
    10: 'other' as const, 11: 'other' as const, 12: 'other' as const,
  };

  it('returns exactly 10 YearParams', () => {
    const params = generateForwardParams(
      mockAnnualStats,
      DEFAULT_CALIBRATION_OPTIONS,
      dummyHazards,
      dummyHazards,
      dummySeasonDef,
    );
    expect(params).toHaveLength(10);
  });

  it('year numbers are 1-10', () => {
    const params = generateForwardParams(
      mockAnnualStats,
      DEFAULT_CALIBRATION_OPTIONS,
      dummyHazards,
      dummyHazards,
      dummySeasonDef,
    );
    params.forEach((p, i) => {
      expect(p.year).toBe(i + 1);
    });
  });

  it('applies log-space growth rate correctly', () => {
    const growthRate = 0.05; // 5%
    const options = { ...DEFAULT_CALIBRATION_OPTIONS, growthRatePerYear: growthRate };

    const params = generateForwardParams(
      mockAnnualStats,
      options,
      dummyHazards,
      dummyHazards,
      dummySeasonDef,
    );

    const baseMu = params[0]!.normal.mu;
    const logGrowth = Math.log(1 + growthRate);

    // Year 5 (index 4) should have mu = baseMu + logGrowth * 4
    expect(params[4]!.normal.mu).toBeCloseTo(baseMu + logGrowth * 4, 8);

    // Year 10 (index 9) should have mu = baseMu + logGrowth * 9
    expect(params[9]!.normal.mu).toBeCloseTo(baseMu + logGrowth * 9, 8);
  });

  it('year 1 has no growth applied (i=0)', () => {
    const options = { ...DEFAULT_CALIBRATION_OPTIONS, growthRatePerYear: 0.10 };
    const zero = { ...DEFAULT_CALIBRATION_OPTIONS, growthRatePerYear: 0 };

    const withGrowth = generateForwardParams(mockAnnualStats, options, dummyHazards, dummyHazards, dummySeasonDef);
    const noGrowth = generateForwardParams(mockAnnualStats, zero, dummyHazards, dummyHazards, dummySeasonDef);

    // Year 1 mu should be the same regardless of growth rate
    expect(withGrowth[0]!.normal.mu).toBeCloseTo(noGrowth[0]!.normal.mu, 8);
  });

  it('uses only the last recentYearsCount years for base params', () => {
    const options = { ...DEFAULT_CALIBRATION_OPTIONS, recentYearsCount: 1 };
    const params = generateForwardParams(
      mockAnnualStats,
      options,
      dummyHazards,
      dummyHazards,
      dummySeasonDef,
    );
    // Should use only 2021 data (last 1 year)
    // baseMuNormal = 4.1 (from 2021 only)
    expect(params[0]!.normal.mu).toBeCloseTo(4.1, 4);
  });
});
