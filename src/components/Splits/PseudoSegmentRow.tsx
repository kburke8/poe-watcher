import { Home, Swords } from 'lucide-react';
import type { TownVisit, BossEncounter } from '../../types';

interface TownVisitRowProps {
  kind: 'town';
  visit: TownVisit;
  live?: boolean;
}

interface BossEncounterRowProps {
  kind: 'boss';
  encounter: BossEncounter;
  live?: boolean;
}

type PseudoSegmentRowProps = TownVisitRowProps | BossEncounterRowProps;

export function PseudoSegmentRow(props: PseudoSegmentRowProps) {
  if (props.kind === 'town') {
    return <TownRow visit={props.visit} live={props.live} />;
  }
  return <BossRow encounter={props.encounter} live={props.live} />;
}

function TownRow({ visit, live }: { visit: TownVisit; live?: boolean }) {
  const duration = live
    ? Date.now() - visit.enteredAt
    : visit.durationMs;

  return (
    <div
      className="px-4 py-1.5 flex items-center gap-3"
      style={{ borderLeft: '3px solid var(--color-timer-behind)', paddingLeft: '13px', opacity: 0.7 }}
    >
      <span className="text-xs w-5 text-center flex items-center justify-center text-amber-400">
        <Home className="w-3.5 h-3.5" strokeWidth={1.75} />
      </span>
      <span className="flex-1 text-xs italic text-amber-300 truncate">
        {visit.zoneName}
      </span>
      <span className="text-xs timer-display text-amber-400 min-w-[50px] text-right">
        {live && <span className="animate-pulse mr-0.5">&bull;</span>}
        {formatDuration(duration)}
      </span>
    </div>
  );
}

function BossRow({ encounter, live }: { encounter: BossEncounter; live?: boolean }) {
  const duration = live
    ? Date.now() - encounter.startedAt
    : encounter.durationMs ?? 0;

  return (
    <div
      className="px-4 py-1.5 flex items-center gap-3"
      style={{ borderLeft: '3px solid var(--color-timer-behind)', paddingLeft: '13px', opacity: 0.7 }}
    >
      <span className="text-xs w-5 text-center flex items-center justify-center text-red-400">
        <Swords className="w-3.5 h-3.5" strokeWidth={1.75} />
      </span>
      <span className="flex-1 text-xs italic text-red-300 truncate">
        {encounter.bossName}
      </span>
      <span className="text-xs timer-display text-red-400 min-w-[50px] text-right">
        {live && <span className="animate-pulse mr-0.5">&bull;</span>}
        {formatDuration(duration)}
      </span>
    </div>
  );
}

function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  if (minutes > 0) {
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }
  return `${seconds}s`;
}
