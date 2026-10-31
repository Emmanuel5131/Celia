import { formatValue, layoutChart } from '@/utils/cases/ChartLayout';
import type { Chart } from '@/validations/ReportValidation';

const box = { width: 640, height: 240 };
// Series are told apart by tone, not hue; the seal red is kept for the threshold, which is the line a verdict hangs on.
const fills = ['fill-ink', 'fill-ink-soft', 'fill-ink-muted', 'fill-ink-tint'];
const strokes = ['stroke-ink', 'stroke-ink-soft', 'stroke-ink-muted', 'stroke-ink-tint'];
const swatches = ['bg-ink', 'bg-ink-soft', 'bg-ink-muted', 'bg-ink-tint'];
const maxLabelledBars = 16;

function summary(chart: Chart) {
  return chart.series
    .map(
      (series) =>
        `${series.name}: ${series.values
          .map((value, index) => `${chart.x[index]} ${formatValue(value, chart.unit)}`)
          .join(', ')}`,
    )
    .join('. ');
}

/**
 * One chart of a test, drawn as an SVG from the numbers the notebook wrote. Bars start at zero, a threshold is a dashed line in the
 * seal colour, and a screen reader gets the same numbers as text. The report's table stays beside it, so nothing is only in the picture.
 * @param props - The chart props.
 * @param props.chart - The chart as the report holds it.
 * @returns The figure.
 */
export function ReportChart(props: { chart: Chart }) {
  const { chart } = props;
  const layout = layoutChart(chart, box);
  const labelled = chart.series.flatMap((series) => series.values).length <= maxLabelledBars;

  return (
    <figure className="grid gap-2">
      {chart.title && <figcaption className="text-sm font-medium">{chart.title}</figcaption>}
      {chart.series.length > 1 && (
        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-ink-muted">
          {chart.series.map((series, index) => (
            <li key={series.name} className="flex items-center gap-2">
              <span className={`size-2 ${swatches[index] ?? 'bg-ink'}`} aria-hidden="true" />
              {series.name}
            </li>
          ))}
        </ul>
      )}
      <svg
        viewBox={`0 0 ${box.width} ${box.height}`}
        className="h-auto w-full max-w-3xl overflow-visible"
      >
        <title>{summary(chart)}</title>
        {layout.grid.map((y, index) => (
          <g key={y}>
            <line
              x1={layout.plot.left}
              x2={layout.plot.right}
              y1={y}
              y2={y}
              className="stroke-line-soft"
            />
            {index > 0 && (
              <text x={layout.plot.left} y={y - 4} className="fill-ink-muted text-[11px]">
                {formatValue((layout.max * index) / 2, chart.unit)}
              </text>
            )}
          </g>
        ))}
        {layout.bars.map((bar) => (
          <g key={`${bar.series}-${bar.index}`}>
            <rect
              x={bar.x}
              y={bar.y}
              width={bar.width}
              height={bar.height}
              className={fills[bar.series] ?? 'fill-ink'}
            />
            {labelled && bar.value > 0 && (
              <text
                x={bar.x + bar.width / 2}
                y={bar.y - 4}
                textAnchor="middle"
                className="fill-ink text-[11px]"
              >
                {formatValue(bar.value)}
              </text>
            )}
          </g>
        ))}
        {layout.lines.map((line) => (
          <g key={line.series}>
            <polyline
              fill="none"
              strokeWidth={2}
              className={strokes[line.series] ?? 'stroke-ink'}
              points={line.points.map((point) => `${point.x},${point.y}`).join(' ')}
            />
            {line.points.map((point) => (
              <circle
                key={point.x}
                cx={point.x}
                cy={point.y}
                r={3}
                className={fills[line.series] ?? 'fill-ink'}
              />
            ))}
          </g>
        ))}
        <line
          x1={layout.plot.left}
          x2={layout.plot.right}
          y1={layout.plot.bottom}
          y2={layout.plot.bottom}
          className="stroke-ink-muted"
        />
        {layout.threshold && (
          <g>
            <line
              x1={layout.plot.left}
              x2={layout.plot.right}
              y1={layout.threshold.y}
              y2={layout.threshold.y}
              strokeDasharray="6 4"
              strokeWidth={1.5}
              className="stroke-seal"
            />
            <text
              x={layout.plot.right}
              y={layout.threshold.y - 4}
              textAnchor="end"
              className="fill-seal text-[11px]"
            >
              {layout.threshold.label}
            </text>
          </g>
        )}
        {layout.labels.map((label) => (
          <text
            key={label.index}
            x={label.x}
            y={box.height - 10}
            textAnchor="middle"
            className="fill-ink-muted text-[11px]"
          >
            {label.text}
          </text>
        ))}
      </svg>
    </figure>
  );
}
