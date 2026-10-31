import type { Chart } from '@/validations/ReportValidation';

type Box = { width: number; height: number };

type ChartBar = {
  series: number;
  index: number;
  x: number;
  y: number;
  width: number;
  height: number;
  value: number;
};

type ChartLine = { series: number; points: { x: number; y: number; value: number }[] };

const padding = { left: 8, right: 8, top: 22, bottom: 30 };
const maxLabels = 10;
const labelLength = 14;

/**
 * Rounds a number up to a tidy top for a chart's scale: 1, 2 or 5 times a power of ten.
 * @param value - The largest value to show.
 * @returns A tidy number that is at least `value`, or 1 when there is nothing to show.
 */
export function niceMax(value: number) {
  if (!(value > 0)) {
    return 1;
  }

  const power = 10 ** Math.floor(Math.log10(value));
  const step = [1, 2, 5, 10].find((candidate) => candidate * power >= value) ?? 10;

  return step * power;
}

/**
 * Writes a chart's number the way it is shown beside a bar: whole numbers as they are, others to two places with no trailing zeros,
 * and the unit after it (a percent sign sits right against the number).
 * @param value - The number.
 * @param unit - The unit, such as `ETH` or `%`.
 * @returns The text.
 */
export function formatValue(value: number, unit?: string) {
  const text = Number.isInteger(value) ? String(value) : String(Number(value.toFixed(2)));

  if (!unit) {
    return text;
  }

  return unit === '%' ? `${text}%` : `${text} ${unit}`;
}

/**
 * Shortens a label so it fits under its bar.
 * @param text - The label.
 * @returns The label, cut with an ellipsis when it is long.
 */
export function shortLabel(text: string) {
  return text.length > labelLength ? `${text.slice(0, labelLength - 1)}…` : text;
}

/**
 * Works out where everything in a chart goes, in the units of a box, so the web page and the PDF draw the same chart. Bars start
 * at zero, the scale tops out at a tidy number, a threshold is a line across the plot, and long runs of labels are thinned.
 * @param chart - The chart as the report holds it.
 * @param box - The size to draw it in.
 * @returns The bars, the lines, the gridlines, the labels under the axis and the threshold line.
 */
export function layoutChart(chart: Chart, box: Box) {
  const { left, top } = padding;
  const width = box.width - padding.left - padding.right;
  const height = box.height - padding.top - padding.bottom;
  const baseline = top + height;
  const values = chart.series.flatMap((series) => series.values);
  const max = niceMax(Math.max(0, ...values, chart.threshold?.value ?? 0));
  const yOf = (value: number) => baseline - (Math.max(value, 0) / max) * height;

  const groups = chart.x.length;
  const groupWidth = width / groups;
  const inner = groupWidth * 0.72;
  const seriesCount = chart.series.length;
  const barWidth = inner / seriesCount;

  const bars: ChartBar[] =
    chart.type === 'bar'
      ? chart.series.flatMap((series, seriesIndex) =>
          series.values.map((value, index) => ({
            series: seriesIndex,
            index,
            x: left + index * groupWidth + (groupWidth - inner) / 2 + seriesIndex * barWidth,
            y: yOf(value),
            width: Math.max(barWidth - (seriesCount > 1 ? 2 : 0), 1),
            height: baseline - yOf(value),
            value,
          })),
        )
      : [];

  const lines: ChartLine[] =
    chart.type === 'line'
      ? chart.series.map((series, seriesIndex) => ({
          series: seriesIndex,
          points: series.values.map((value, index) => ({
            x: left + (index + 0.5) * groupWidth,
            y: yOf(value),
            value,
          })),
        }))
      : [];

  const step = Math.ceil(groups / maxLabels);
  const labels = chart.x.flatMap((text, index) =>
    index % step === 0
      ? [{ index, x: left + (index + 0.5) * groupWidth, text: shortLabel(text) }]
      : [],
  );

  return {
    plot: { left, right: left + width, top, bottom: baseline },
    max,
    bars,
    lines,
    labels,
    grid: [0, 0.5, 1].map((fraction) => baseline - fraction * height),
    threshold: chart.threshold
      ? { y: yOf(chart.threshold.value), label: chart.threshold.label }
      : undefined,
  };
}
