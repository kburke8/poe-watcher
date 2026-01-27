import { useMemo } from 'react';
import { useRunStore } from '../../stores/runStore';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { format } from 'date-fns';

export function AnalyticsTab() {
  const { filteredRuns, runStats, splitStats } = useRunStore();

  // Prepare time trend data (runs over time)
  const trendData = useMemo(() => {
    const completedRuns = filteredRuns
      .filter((r) => r.isCompleted && r.totalTimeMs)
      .sort((a, b) => new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime());

    return completedRuns.map((run) => ({
      date: format(new Date(run.startedAt), 'MMM d'),
      fullDate: run.startedAt,
      time: run.totalTimeMs! / 1000 / 60, // Convert to minutes
      character: run.characterName || run.character,
    }));
  }, [filteredRuns]);

  // Prepare split comparison data
  const splitComparisonData = useMemo(() => {
    return splitStats.slice(0, 15).map((stat) => ({
      name: stat.breakpointName.length > 15
        ? stat.breakpointName.substring(0, 15) + '...'
        : stat.breakpointName,
      fullName: stat.breakpointName,
      average: Math.round(stat.averageTimeMs / 1000 / 60 * 10) / 10, // Minutes with 1 decimal
      best: Math.round(stat.bestTimeMs / 1000 / 60 * 10) / 10,
      townTime: Math.round(stat.averageTownTimeMs / 1000), // Seconds
      runs: stat.runCount,
    }));
  }, [splitStats]);

  const formatTimeFromMinutes = (minutes: number): string => {
    const hrs = Math.floor(minutes / 60);
    const mins = Math.floor(minutes % 60);
    const secs = Math.floor((minutes * 60) % 60);

    if (hrs > 0) {
      return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="h-full overflow-auto space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-4 gap-4">
        <div className="p-4 bg-[--color-surface] rounded-lg">
          <div className="text-xs text-[--color-text-muted] mb-1">Total Runs</div>
          <div className="text-2xl font-bold text-[--color-text]">
            {runStats?.totalRuns ?? 0}
          </div>
        </div>
        <div className="p-4 bg-[--color-surface] rounded-lg">
          <div className="text-xs text-[--color-text-muted] mb-1">Completed</div>
          <div className="text-2xl font-bold text-[--color-timer-ahead]">
            {runStats?.completedRuns ?? 0}
            {runStats && runStats.totalRuns > 0 && (
              <span className="text-sm font-normal text-[--color-text-muted] ml-2">
                ({Math.round((runStats.completedRuns / runStats.totalRuns) * 100)}%)
              </span>
            )}
          </div>
        </div>
        <div className="p-4 bg-[--color-surface] rounded-lg">
          <div className="text-xs text-[--color-text-muted] mb-1">Average Time</div>
          <div className="text-2xl font-bold timer-display text-[--color-text]">
            {runStats?.averageTimeMs ? formatTime(runStats.averageTimeMs) : '--:--'}
          </div>
        </div>
        <div className="p-4 bg-[--color-surface] rounded-lg">
          <div className="text-xs text-[--color-text-muted] mb-1">Best Time</div>
          <div className="text-2xl font-bold timer-display text-[--color-poe-gold]">
            {runStats?.bestTimeMs ? formatTime(runStats.bestTimeMs) : '--:--'}
          </div>
        </div>
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-2 gap-6">
        {/* Time Trend Chart */}
        <div className="p-4 bg-[--color-surface] rounded-lg">
          <h3 className="text-sm font-semibold text-[--color-text] mb-4">
            Performance Over Time
          </h3>
          {trendData.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                <XAxis
                  dataKey="date"
                  stroke="rgba(255,255,255,0.5)"
                  tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 11 }}
                />
                <YAxis
                  stroke="rgba(255,255,255,0.5)"
                  tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 11 }}
                  tickFormatter={(value) => formatTimeFromMinutes(value)}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'var(--color-surface-elevated)',
                    border: '1px solid var(--color-border)',
                    borderRadius: '8px',
                  }}
                  labelStyle={{ color: 'var(--color-text)' }}
                  formatter={(value: number) => [formatTimeFromMinutes(value), 'Time']}
                />
                <Line
                  type="monotone"
                  dataKey="time"
                  stroke="var(--color-poe-gold)"
                  strokeWidth={2}
                  dot={{ fill: 'var(--color-poe-gold)', strokeWidth: 0, r: 4 }}
                  activeDot={{ fill: 'var(--color-poe-gold)', strokeWidth: 0, r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[250px] flex items-center justify-center text-[--color-text-muted]">
              No completed runs to display
            </div>
          )}
        </div>

        {/* Split Comparison Chart */}
        <div className="p-4 bg-[--color-surface] rounded-lg">
          <h3 className="text-sm font-semibold text-[--color-text] mb-4">
            Split Times (Average vs Best)
          </h3>
          {splitComparisonData.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={splitComparisonData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                <XAxis
                  type="number"
                  stroke="rgba(255,255,255,0.5)"
                  tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 11 }}
                  tickFormatter={(value) => `${value}m`}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  stroke="rgba(255,255,255,0.5)"
                  tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 10 }}
                  width={100}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'var(--color-surface-elevated)',
                    border: '1px solid var(--color-border)',
                    borderRadius: '8px',
                  }}
                  labelStyle={{ color: 'var(--color-text)' }}
                  formatter={(value: number, name: string) => [
                    formatTimeFromMinutes(value),
                    name === 'average' ? 'Average' : 'Best',
                  ]}
                  labelFormatter={(label, payload) => {
                    if (payload && payload[0]) {
                      return payload[0].payload.fullName;
                    }
                    return label;
                  }}
                />
                <Legend />
                <Bar
                  dataKey="average"
                  fill="rgba(175, 141, 71, 0.6)"
                  name="Average"
                  radius={[0, 4, 4, 0]}
                />
                <Bar
                  dataKey="best"
                  fill="var(--color-timer-ahead)"
                  name="Best"
                  radius={[0, 4, 4, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[250px] flex items-center justify-center text-[--color-text-muted]">
              No split data to display
            </div>
          )}
        </div>
      </div>

      {/* Split Stats Table */}
      <div className="p-4 bg-[--color-surface] rounded-lg">
        <h3 className="text-sm font-semibold text-[--color-text] mb-4">Per-Split Statistics</h3>
        {splitStats.length > 0 ? (
          <div className="overflow-auto max-h-[300px]">
            <table className="w-full">
              <thead className="sticky top-0 bg-[--color-surface]">
                <tr className="border-b border-[--color-border] text-[--color-text-muted] text-xs">
                  <th className="p-2 text-left">Breakpoint</th>
                  <th className="p-2 text-right">Avg Time</th>
                  <th className="p-2 text-right">Best Time</th>
                  <th className="p-2 text-right">Avg Town</th>
                  <th className="p-2 text-right">Runs</th>
                </tr>
              </thead>
              <tbody>
                {splitStats.map((stat) => (
                  <tr
                    key={stat.breakpointName}
                    className="border-b border-[--color-border] hover:bg-[--color-surface-elevated]"
                  >
                    <td className="p-2 text-[--color-text] text-sm">{stat.breakpointName}</td>
                    <td className="p-2 text-right timer-display text-[--color-text-muted] text-sm">
                      {formatTime(stat.averageTimeMs)}
                    </td>
                    <td className="p-2 text-right timer-display text-[--color-timer-ahead] text-sm">
                      {formatTime(stat.bestTimeMs)}
                    </td>
                    <td className="p-2 text-right timer-display text-[--color-text-muted] text-sm">
                      {formatTime(stat.averageTownTimeMs)}
                    </td>
                    <td className="p-2 text-right text-[--color-text-muted] text-sm">
                      {stat.runCount}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="py-8 text-center text-[--color-text-muted]">
            No split statistics available for the current filters
          </div>
        )}
      </div>
    </div>
  );
}

function formatTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}
