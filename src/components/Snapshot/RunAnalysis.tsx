import { useMemo } from 'react';
import { BarChart3 } from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { EmptyState } from '../Shared/EmptyState';
import type { Split } from '../../types';

interface RunAnalysisProps {
  splits: Split[];
  totalTimeMs: number | null;
  pbTimeMs?: number | null;
  /** Map of breakpointName -> bestSegmentMs */
  goldSplits?: Map<string, number>;
}

interface SegmentData {
  name: string;
  fullName: string;
  playTime: number;
  townTime: number;
  bossTime: number;
  deaths: number;
  cumulative: number;
  segmentMs: number;
  goldTime: number | null;
}

export function RunAnalysis({ splits, totalTimeMs, pbTimeMs, goldSplits }: RunAnalysisProps) {
  const segmentData = useMemo((): SegmentData[] => {
    return splits.map((split, i) => {
      const prev = i > 0 ? splits[i - 1] : null;
      const segTown = split.townTimeMs - (prev?.townTimeMs ?? 0);
      const segDeaths = split.deathCount - (prev?.deathCount ?? 0);
      const playTime = split.segmentTimeMs - segTown;

      const goldMs = goldSplits?.get(split.breakpointName) ?? null;

      return {
        name: split.breakpointName.length > 18
          ? split.breakpointName.substring(0, 18) + '...'
          : split.breakpointName,
        fullName: split.breakpointName,
        playTime: Math.max(0, playTime) / 1000 / 60,
        townTime: segTown / 1000 / 60,
        bossTime: split.bossFightMs / 1000 / 60,
        deaths: segDeaths,
        cumulative: split.splitTimeMs,
        segmentMs: split.segmentTimeMs,
        goldTime: goldMs !== null ? goldMs / 1000 / 60 : null,
      };
    });
  }, [splits, goldSplits]);

  // Summary stats from last split
  const summary = useMemo(() => {
    if (splits.length === 0) return null;
    const last = splits[splits.length - 1];
    return {
      totalTime: totalTimeMs ?? last.splitTimeMs,
      townTime: last.townTimeMs,
      hideoutTime: last.hideoutTimeMs,
      deaths: last.deathCount,
      bossTime: splits.reduce((sum, s) => sum + s.bossFightMs, 0),
    };
  }, [splits, totalTimeMs]);

  if (splits.length === 0) {
    return (
      <EmptyState
        icon={BarChart3}
        title="No splits data"
        description="Complete splits during a run to see analysis."
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary stats */}
      {summary && (
        <div className="grid grid-cols-5 gap-3">
          <div className="p-3 card-inset rounded-lg">
            <div className="text-xs text-[--color-text-muted] mb-1">Total Time</div>
            <div className="text-lg font-bold timer-display text-[--color-text]">
              {formatTime(summary.totalTime)}
            </div>
            {pbTimeMs != null && pbTimeMs > 0 && (
              <div className="text-xs timer-display text-[--color-poe-gold] mt-0.5">
                PB: {formatTime(pbTimeMs)}
              </div>
            )}
          </div>
          <StatCard label="Town Time" value={formatTime(summary.townTime)} muted />
          <StatCard label="Hideout Time" value={formatTime(summary.hideoutTime)} muted />
          <StatCard
            label="Deaths"
            value={String(summary.deaths)}
            color={summary.deaths > 0 ? 'var(--color-timer-behind)' : undefined}
          />
          <StatCard label="Boss Time" value={formatTime(summary.bossTime)} muted />
        </div>
      )}

      {/* Segment times chart */}
      <div className="p-4 card-inset rounded-lg">
        <h3 className="text-sm font-semibold text-[--color-text] mb-4">
          Segment Breakdown
        </h3>
        <ResponsiveContainer width="100%" height={Math.max(250, segmentData.length * 28)}>
          <BarChart data={segmentData} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(154, 142, 130, 0.15)" />
            <XAxis
              type="number"
              stroke="rgba(154, 142, 130, 0.5)"
              tick={{ fill: 'rgba(154, 142, 130, 0.5)', fontSize: 11 }}
              tickFormatter={(v) => `${Math.round(v)}m`}
            />
            <YAxis
              type="category"
              dataKey="name"
              stroke="rgba(154, 142, 130, 0.5)"
              tick={{ fill: 'rgba(154, 142, 130, 0.5)', fontSize: 10 }}
              width={120}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'var(--color-surface-elevated)',
                border: '1px solid var(--color-border)',
                borderRadius: '8px',
              }}
              labelStyle={{ color: 'var(--color-text)' }}
              formatter={(value: number, name: string) => {
                if (name === 'PB') return [formatTimeFromMinutes(value), 'PB Segment'];
                return [formatTimeFromMinutes(value), name];
              }}
              labelFormatter={(_label: string, payload: Array<{ payload?: SegmentData }>) => {
                const data = payload?.[0]?.payload;
                if (!data) return '';
                const parts = [data.fullName];
                if (data.deaths > 0) parts.push(`Deaths: ${data.deaths}`);
                return parts.join(' | ');
              }}
            />
            <Legend />
            <Bar
              dataKey="playTime"
              stackId="time"
              fill="var(--color-timer-ahead)"
              name="Play"
              radius={[0, 0, 0, 0]}
            />
            <Bar
              dataKey="townTime"
              stackId="time"
              fill="rgba(175, 141, 71, 0.5)"
              name="Town"
              radius={[0, 0, 0, 0]}
            />
            <Bar
              dataKey="bossTime"
              stackId="time"
              fill="var(--color-timer-behind)"
              name="Boss"
              radius={[0, 4, 4, 0]}
            />
            {goldSplits && goldSplits.size > 0 && (
              <Bar
                dataKey="goldTime"
                fill="transparent"
                name="PB"
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                shape={(props: any) => {
                  if (!props.width || props.width <= 0) return <g />;
                  return (
                    <line
                      x1={props.x + props.width}
                      y1={props.y + 1}
                      x2={props.x + props.width}
                      y2={props.y + props.height - 1}
                      stroke="var(--color-poe-gold)"
                      strokeWidth={2.5}
                    />
                  );
                }}
              />
            )}
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Split times table */}
      <div className="p-4 card-inset rounded-lg">
        <h3 className="text-sm font-semibold text-[--color-text] mb-4">Split Details</h3>
        <div>
          <table className="w-full">
            <thead>
              <tr className="border-b border-[--color-border] text-[--color-text-muted] text-xs">
                <th className="p-2 text-left">Split</th>
                <th className="p-2 text-right">Segment</th>
                <th className="p-2 text-right">Cumulative</th>
                <th className="p-2 text-right">Town</th>
                <th className="p-2 text-right">Boss</th>
                <th className="p-2 text-right">Deaths</th>
              </tr>
            </thead>
            <tbody>
              {segmentData.map((seg, i) => (
                <tr
                  key={i}
                  className="border-b border-[--color-border] hover:bg-[--color-surface-elevated]"
                >
                  <td className="p-2 text-[--color-text] text-sm" title={seg.fullName}>
                    {seg.fullName}
                  </td>
                  <td className="p-2 text-right timer-display text-[--color-text] text-sm">
                    {formatTime(seg.segmentMs)}
                  </td>
                  <td className="p-2 text-right timer-display text-[--color-text-muted] text-sm">
                    {formatTime(seg.cumulative)}
                  </td>
                  <td className="p-2 text-right timer-display text-[--color-text-muted] text-sm">
                    {formatTimeFromMinutes(seg.townTime)}
                  </td>
                  <td className="p-2 text-right timer-display text-[--color-text-muted] text-sm">
                    {seg.bossTime > 0 ? formatTimeFromMinutes(seg.bossTime) : '-'}
                  </td>
                  <td className={`p-2 text-right text-sm ${seg.deaths > 0 ? 'text-[--color-timer-behind]' : 'text-[--color-text-muted]'}`}>
                    {seg.deaths > 0 ? seg.deaths : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, muted, color }: { label: string; value: string; muted?: boolean; color?: string }) {
  return (
    <div className="p-3 card-inset rounded-lg">
      <div className="text-xs text-[--color-text-muted] mb-1">{label}</div>
      <div
        className={`text-lg font-bold timer-display ${muted ? 'text-[--color-text-muted]' : 'text-[--color-text]'}`}
        style={color ? { color } : undefined}
      >
        {value}
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

function formatTimeFromMinutes(minutes: number): string {
  const totalSec = Math.round(minutes * 60);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}
