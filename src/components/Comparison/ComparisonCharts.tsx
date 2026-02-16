import { useState, useMemo } from 'react';
import { BarChart3, ChevronDown, ChevronUp } from 'lucide-react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  ReferenceLine,
} from 'recharts';
import type { Run, Split } from '../../types';

interface SplitComparison {
  breakpointName: string;
  leftSplit: Split | null;
  rightSplit: Split | null;
}

interface ComparisonChartsProps {
  comparisonData: SplitComparison[];
  leftRun: Run;
  rightRun: Run;
}

interface ChartDataPoint {
  name: string;
  fullName: string;
  leftCumulative: number | null;
  rightCumulative: number | null;
  leftTown: number | null;
  rightTown: number | null;
  deltaMinutes: number | null;
  deltaMs: number | null;
  leftSegmentPlay: number | null;
  rightSegmentPlay: number | null;
  leftSegmentTown: number | null;
  rightSegmentTown: number | null;
  leftDeaths: number | null;
  rightDeaths: number | null;
}

type ChartTab = 'race' | 'delta' | 'segments';

function formatMinutesToTime(minutes: number): string {
  const totalSeconds = Math.round(Math.abs(minutes) * 60);
  const hrs = Math.floor(totalSeconds / 3600);
  const mins = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;

  const sign = minutes < 0 ? '-' : '';
  if (hrs > 0) {
    return `${sign}${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${sign}${mins}:${secs.toString().padStart(2, '0')}`;
}

function formatDeltaMs(ms: number): string {
  const sign = ms >= 0 ? '+' : '-';
  const absMs = Math.abs(ms);
  const totalSeconds = Math.floor(absMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${sign}${minutes}:${seconds.toString().padStart(2, '0')}`;
}

function getTownMs(split: Split): number {
  return (split.townTimeMs ?? 0) + (split.hideoutTimeMs ?? 0);
}

export function ComparisonCharts({ comparisonData, leftRun, rightRun }: ComparisonChartsProps) {
  const [showCharts, setShowCharts] = useState(true);
  const [activeTab, setActiveTab] = useState<ChartTab>('race');

  const leftName = leftRun.characterName || leftRun.character || 'Left';
  const rightName = rightRun.characterName || rightRun.character || 'Right';

  const chartData = useMemo<ChartDataPoint[]>(() => {
    let prevLeftTown = 0;
    let prevRightTown = 0;
    let prevLeftDeaths = 0;
    let prevRightDeaths = 0;

    return comparisonData.map((row) => {
      const leftCum = row.leftSplit ? row.leftSplit.splitTimeMs / 1000 / 60 : null;
      const rightCum = row.rightSplit ? row.rightSplit.splitTimeMs / 1000 / 60 : null;

      // Cumulative town+hideout time
      const leftTownCum = row.leftSplit ? getTownMs(row.leftSplit) : null;
      const rightTownCum = row.rightSplit ? getTownMs(row.rightSplit) : null;

      // Segment town time (delta from previous split's cumulative town)
      const leftSegTown = leftTownCum !== null ? (leftTownCum - prevLeftTown) / 1000 / 60 : null;
      const rightSegTown = rightTownCum !== null ? (rightTownCum - prevRightTown) / 1000 / 60 : null;
      if (leftTownCum !== null) prevLeftTown = leftTownCum;
      if (rightTownCum !== null) prevRightTown = rightTownCum;

      // Segment play time = total segment - town segment
      const leftSeg = row.leftSplit ? row.leftSplit.segmentTimeMs / 1000 / 60 : null;
      const rightSeg = row.rightSplit ? row.rightSplit.segmentTimeMs / 1000 / 60 : null;
      const leftSegPlay = leftSeg !== null && leftSegTown !== null ? Math.max(0, leftSeg - leftSegTown) : leftSeg;
      const rightSegPlay = rightSeg !== null && rightSegTown !== null ? Math.max(0, rightSeg - rightSegTown) : rightSeg;

      // Per-segment deaths (derived from cumulative)
      const leftCumDeaths = row.leftSplit ? (row.leftSplit.deathCount ?? 0) : null;
      const rightCumDeaths = row.rightSplit ? (row.rightSplit.deathCount ?? 0) : null;
      const leftDeaths = leftCumDeaths !== null ? leftCumDeaths - prevLeftDeaths : null;
      const rightDeaths = rightCumDeaths !== null ? rightCumDeaths - prevRightDeaths : null;
      if (leftCumDeaths !== null) prevLeftDeaths = leftCumDeaths;
      if (rightCumDeaths !== null) prevRightDeaths = rightCumDeaths;

      const deltaMs =
        row.leftSplit && row.rightSplit
          ? row.leftSplit.splitTimeMs - row.rightSplit.splitTimeMs
          : null;
      const deltaMinutes = deltaMs !== null ? deltaMs / 1000 / 60 : null;

      return {
        name:
          row.breakpointName.length > 20
            ? row.breakpointName.substring(0, 20) + '...'
            : row.breakpointName,
        fullName: row.breakpointName,
        leftCumulative: leftCum,
        rightCumulative: rightCum,
        leftTown: leftTownCum !== null ? leftTownCum / 1000 / 60 : null,
        rightTown: rightTownCum !== null ? rightTownCum / 1000 / 60 : null,
        deltaMinutes,
        deltaMs,
        leftSegmentPlay: leftSegPlay,
        rightSegmentPlay: rightSegPlay,
        leftSegmentTown: leftSegTown,
        rightSegmentTown: rightSegTown,
        leftDeaths,
        rightDeaths,
      };
    });
  }, [comparisonData]);

  const tabs: { key: ChartTab; label: string }[] = [
    { key: 'race', label: 'Race' },
    { key: 'delta', label: 'Delta' },
    { key: 'segments', label: 'Segments' },
  ];

  const tooltipStyle = {
    backgroundColor: 'var(--color-surface-elevated)',
    border: '1px solid var(--color-border)',
    borderRadius: '8px',
  };

  const axisTickStyle = { fill: 'rgba(154, 142, 130, 0.5)', fontSize: 10 };
  const axisStroke = 'rgba(154, 142, 130, 0.5)';
  const gridStroke = 'rgba(154, 142, 130, 0.15)';

  return (
    <div className="card-inset rounded-lg mb-4">
      {/* Collapsible header */}
      <button
        onClick={() => setShowCharts(!showCharts)}
        className="w-full flex items-center justify-between p-3 hover:bg-[--color-surface-elevated] rounded-lg transition-colors"
      >
        <div className="flex items-center gap-2 text-sm font-semibold text-[--color-text]">
          <BarChart3 size={16} className="text-[--color-poe-gold]" />
          Charts
        </div>
        {showCharts ? (
          <ChevronUp size={16} className="text-[--color-text-muted]" />
        ) : (
          <ChevronDown size={16} className="text-[--color-text-muted]" />
        )}
      </button>

      {showCharts && (
        <div className="px-3 pb-3">
          {/* Tab buttons */}
          <div className="flex gap-1 mb-3">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`px-3 py-1.5 text-xs font-medium rounded-full transition-colors ${
                  activeTab === tab.key
                    ? 'bg-[--color-poe-gold] text-[--color-bg]'
                    : 'text-[--color-text-muted] hover:text-[--color-text] hover:bg-[--color-surface-elevated]'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Active chart */}
          <ResponsiveContainer width="100%" height={280}>
            {activeTab === 'race' ? (
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
                <XAxis
                  dataKey="name"
                  stroke={axisStroke}
                  tick={axisTickStyle}
                  angle={-45}
                  textAnchor="end"
                  height={60}
                  interval="preserveStartEnd"
                />
                <YAxis
                  stroke={axisStroke}
                  tick={{ ...axisTickStyle, fontSize: 11 }}
                  tickFormatter={(value) => formatMinutesToTime(value)}
                />
                <Tooltip
                  contentStyle={tooltipStyle}
                  labelStyle={{ color: 'var(--color-text)' }}
                  labelFormatter={(_label: string, payload: Array<{ payload?: ChartDataPoint }>) =>
                    payload?.[0]?.payload?.fullName || _label
                  }
                  formatter={(value: number, name: string) => {
                    const labels: Record<string, string> = {
                      leftCumulative: leftName,
                      rightCumulative: rightName,
                      leftTown: `${leftName} (town)`,
                      rightTown: `${rightName} (town)`,
                    };
                    return [formatMinutesToTime(value), labels[name] || name];
                  }}
                />
                <Legend
                  formatter={(value: string) => {
                    const labels: Record<string, string> = {
                      leftCumulative: leftName,
                      rightCumulative: rightName,
                      leftTown: `${leftName} (town)`,
                      rightTown: `${rightName} (town)`,
                    };
                    return labels[value] || value;
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="leftCumulative"
                  stroke="var(--color-poe-gold)"
                  strokeWidth={2}
                  dot={{ fill: 'var(--color-poe-gold)', strokeWidth: 0, r: 3 }}
                  activeDot={{ fill: 'var(--color-poe-gold)', strokeWidth: 0, r: 5 }}
                  connectNulls
                />
                <Line
                  type="monotone"
                  dataKey="rightCumulative"
                  stroke="rgba(175, 141, 71, 0.6)"
                  strokeWidth={2}
                  strokeDasharray="6 3"
                  dot={{ fill: 'rgba(175, 141, 71, 0.6)', strokeWidth: 0, r: 3 }}
                  activeDot={{ fill: 'rgba(175, 141, 71, 0.6)', strokeWidth: 0, r: 5 }}
                  connectNulls
                />
                <Line
                  type="monotone"
                  dataKey="leftTown"
                  stroke="rgba(234, 179, 8, 0.4)"
                  strokeWidth={1.5}
                  strokeDasharray="4 4"
                  dot={false}
                  connectNulls
                />
                <Line
                  type="monotone"
                  dataKey="rightTown"
                  stroke="rgba(234, 179, 8, 0.25)"
                  strokeWidth={1.5}
                  strokeDasharray="2 3"
                  dot={false}
                  connectNulls
                />
              </LineChart>
            ) : activeTab === 'delta' ? (
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
                <XAxis
                  dataKey="name"
                  stroke={axisStroke}
                  tick={axisTickStyle}
                  angle={-45}
                  textAnchor="end"
                  height={60}
                  interval="preserveStartEnd"
                />
                <YAxis
                  stroke={axisStroke}
                  tick={{ ...axisTickStyle, fontSize: 11 }}
                  tickFormatter={(value) => formatMinutesToTime(value)}
                />
                <Tooltip
                  contentStyle={tooltipStyle}
                  labelStyle={{ color: 'var(--color-text)' }}
                  cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                  labelFormatter={(_label: string, payload: Array<{ payload?: ChartDataPoint }>) =>
                    payload?.[0]?.payload?.fullName || _label
                  }
                  formatter={(_value: number, _name: string, props: { payload?: ChartDataPoint }) => {
                    const p = props.payload;
                    const ms = p?.deltaMs;
                    if (ms === null || ms === undefined) return ['--', 'Delta'];
                    const label = ms > 0 ? `${leftName} behind` : ms < 0 ? `${leftName} ahead` : 'Even';
                    const deathInfo = (p?.leftDeaths || p?.rightDeaths)
                      ? ` [Deaths: ${p?.leftDeaths ?? 0}/${p?.rightDeaths ?? 0}]`
                      : '';
                    return [formatDeltaMs(ms) + deathInfo, label];
                  }}
                />
                <Legend
                  payload={[
                    { value: `${leftName} ahead`, type: 'rect', color: 'var(--color-timer-ahead)' },
                    { value: `${leftName} behind`, type: 'rect', color: 'var(--color-timer-behind)' },
                  ]}
                />
                <ReferenceLine y={0} stroke="rgba(154, 142, 130, 0.4)" strokeDasharray="3 3" />
                <Bar dataKey="deltaMinutes" radius={[4, 4, 4, 4]}>
                  {chartData.map((entry, index) => (
                    <Cell
                      key={index}
                      fill={
                        entry.deltaMinutes === null || entry.deltaMinutes === 0
                          ? 'rgba(154, 142, 130, 0.3)'
                          : entry.deltaMinutes > 0
                          ? 'var(--color-timer-behind)'
                          : 'var(--color-timer-ahead)'
                      }
                      fillOpacity={0.8}
                    />
                  ))}
                </Bar>
              </BarChart>
            ) : (
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
                <XAxis
                  dataKey="name"
                  stroke={axisStroke}
                  tick={axisTickStyle}
                  angle={-45}
                  textAnchor="end"
                  height={60}
                  interval="preserveStartEnd"
                />
                <YAxis
                  stroke={axisStroke}
                  tick={{ ...axisTickStyle, fontSize: 11 }}
                  tickFormatter={(value) => formatMinutesToTime(value)}
                />
                <Tooltip
                  contentStyle={tooltipStyle}
                  labelStyle={{ color: 'var(--color-text)' }}
                  cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                  labelFormatter={(_label: string, payload: Array<{ payload?: ChartDataPoint }>) =>
                    payload?.[0]?.payload?.fullName || _label
                  }
                  formatter={(value: number, name: string, props: { payload?: ChartDataPoint }) => {
                    const labels: Record<string, string> = {
                      leftSegmentPlay: leftName,
                      leftSegmentTown: `${leftName} (town)`,
                      rightSegmentPlay: rightName,
                      rightSegmentTown: `${rightName} (town)`,
                    };
                    let label = labels[name] || name;
                    const p = props.payload;
                    // Show deaths on the play-time bars
                    if (name === 'leftSegmentPlay' && p?.leftDeaths) {
                      label += ` (${p.leftDeaths} death${p.leftDeaths > 1 ? 's' : ''})`;
                    }
                    if (name === 'rightSegmentPlay' && p?.rightDeaths) {
                      label += ` (${p.rightDeaths} death${p.rightDeaths > 1 ? 's' : ''})`;
                    }
                    return [formatMinutesToTime(value), label];
                  }}
                />
                <Legend
                  payload={[
                    { value: leftName, type: 'rect', color: 'var(--color-poe-gold)' },
                    { value: `${leftName} (town)`, type: 'rect', color: 'rgba(234, 179, 8, 0.35)' },
                    { value: rightName, type: 'rect', color: 'rgba(175, 141, 71, 0.6)' },
                    { value: `${rightName} (town)`, type: 'rect', color: 'rgba(175, 141, 71, 0.25)' },
                  ]}
                />
                <Bar dataKey="leftSegmentPlay" stackId="left" fill="var(--color-poe-gold)" />
                <Bar dataKey="leftSegmentTown" stackId="left" fill="rgba(234, 179, 8, 0.35)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="rightSegmentPlay" stackId="right" fill="rgba(175, 141, 71, 0.6)" />
                <Bar dataKey="rightSegmentTown" stackId="right" fill="rgba(175, 141, 71, 0.25)" radius={[4, 4, 0, 0]} />
              </BarChart>
            )}
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
