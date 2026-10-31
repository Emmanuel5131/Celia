import { describe, expect, it } from 'vitest';
import type { Chart } from '@/validations/ReportValidation';
import { formatValue, layoutChart, niceMax, shortLabel } from './ChartLayout';

const box = { width: 640, height: 240 };

const bars: Chart = {
  type: 'bar',
  x: ['Paid in', 'Paid out'],
  unit: 'ETH',
  series: [{ name: 'ETH', values: [6.25, 3.125] }],
};

describe(niceMax, () => {
  it.each([
    [6.25, 10],
    [0.9, 1],
    [37, 50],
    [500, 500],
    [1.2, 2],
    [0, 1],
    [-4, 1],
  ])('rounds %s up to %s', (value, expected) => {
    expect(niceMax(value)).toBe(expected);
  });
});

describe(formatValue, () => {
  it('keeps a whole number whole', () => {
    expect(formatValue(92)).toBe('92');
  });

  it('shows two places at most and drops a trailing zero', () => {
    expect(formatValue(6.25, 'ETH')).toBe('6.25 ETH');
    expect(formatValue(6.2, 'ETH')).toBe('6.2 ETH');
    expect(formatValue(3.1456, 'ETH')).toBe('3.15 ETH');
  });

  it('puts a percent sign against the number', () => {
    expect(formatValue(52.1, '%')).toBe('52.1%');
  });
});

describe(shortLabel, () => {
  it('keeps a short label and cuts a long one', () => {
    expect(shortLabel('Paid in')).toBe('Paid in');
    expect(shortLabel('Five largest recipients')).toBe('Five largest …');
  });
});

describe(layoutChart, () => {
  it('draws a bar for every value, starting at the same baseline', () => {
    const layout = layoutChart(bars, box);

    expect(layout.bars).toHaveLength(2);
    expect(layout.bars.map((bar) => bar.y + bar.height)).toStrictEqual([
      layout.plot.bottom,
      layout.plot.bottom,
    ]);
  });

  it('draws a bar in proportion to its value', () => {
    const [first, second] = layoutChart(bars, box).bars;

    expect(first?.height).toBeCloseTo((second?.height ?? 0) * 2);
  });

  it('puts bars of one group side by side', () => {
    const layout = layoutChart(
      {
        ...bars,
        series: [bars.series[0] ?? { name: 'a', values: [1, 1] }, { name: 'b', values: [2, 2] }],
      },
      box,
    );
    const group = layout.bars.filter((bar) => bar.index === 0);

    expect(group).toHaveLength(2);
    expect(group[1]?.x).toBeGreaterThan(group[0]?.x ?? 0);
  });

  it('draws a threshold line at its value on the scale', () => {
    const layout = layoutChart({ ...bars, threshold: { value: 5, label: 'Fixed threshold' } }, box);

    expect(layout.max).toBe(10);
    expect(layout.threshold?.y).toBeCloseTo((layout.plot.top + layout.plot.bottom) / 2);
  });

  it('lets a threshold above every bar raise the scale', () => {
    expect(layoutChart({ ...bars, threshold: { value: 60, label: 'x' } }, box).max).toBe(100);
  });

  it('thins a long run of labels', () => {
    const many: Chart = {
      type: 'bar',
      x: Array.from({ length: 30 }, (_, index) => `D${index}`),
      series: [{ name: 'n', values: Array.from({ length: 30 }, () => 1) }],
    };

    expect(layoutChart(many, box).labels.length).toBeLessThanOrEqual(10);
  });

  it('draws a line chart as points, not bars', () => {
    const layout = layoutChart({ ...bars, type: 'line' }, box);

    expect(layout.bars).toHaveLength(0);
    expect(layout.lines[0]?.points).toHaveLength(2);
  });

  it('draws a zero value as no height', () => {
    const layout = layoutChart({ ...bars, series: [{ name: 'n', values: [0, 4] }] }, box);

    expect(layout.bars[0]?.height).toBe(0);
  });
});
