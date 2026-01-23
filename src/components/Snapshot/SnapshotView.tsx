import { useState } from 'react';
import { useRunStore } from '../../stores/runStore';

export function SnapshotView() {
  const { runs } = useRunStore();
  const [selectedRunId, setSelectedRunId] = useState<number | null>(null);

  const selectedRun = runs.find((r) => r.id === selectedRunId);

  return (
    <div className="h-full flex flex-col p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[--color-text]">Snapshots</h1>
        <p className="text-[--color-text-muted] mt-1">
          Browse character snapshots from your runs
        </p>
      </div>

      <div className="flex-1 flex gap-6">
        {/* Run list */}
        <div className="w-80 bg-[--color-surface] rounded-lg overflow-hidden flex flex-col">
          <div className="p-4 border-b border-[--color-border]">
            <h2 className="font-semibold text-[--color-text]">Runs</h2>
          </div>
          <div className="flex-1 overflow-auto">
            {runs.length === 0 ? (
              <div className="p-4 text-center text-[--color-text-muted]">
                <p>No runs yet.</p>
                <p className="text-sm mt-1">Complete a run to see snapshots.</p>
              </div>
            ) : (
              <div className="divide-y divide-[--color-border]">
                {runs.map((run) => (
                  <button
                    key={run.id}
                    onClick={() => setSelectedRunId(run.id)}
                    className={`w-full p-4 text-left hover:bg-[--color-surface-elevated] transition-colors ${
                      selectedRunId === run.id ? 'bg-[--color-surface-elevated]' : ''
                    }`}
                  >
                    <div className="font-medium text-[--color-text]">{run.characterName}</div>
                    <div className="text-sm text-[--color-text-muted]">
                      {run.class} - {run.league}
                    </div>
                    <div className="text-xs text-[--color-text-muted] mt-1">
                      {run.totalTimeMs ? formatTime(run.totalTimeMs) : 'In Progress'}
                      {run.isPersonalBest && (
                        <span className="ml-2 text-[--color-timer-gold]">PB</span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Snapshot detail */}
        <div className="flex-1 bg-[--color-surface] rounded-lg overflow-hidden">
          {selectedRun ? (
            <SnapshotDetail run={selectedRun} />
          ) : (
            <div className="h-full flex items-center justify-center text-[--color-text-muted]">
              Select a run to view snapshots
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

interface SnapshotDetailProps {
  run: {
    id: number;
    characterName: string;
    class: string;
    league: string;
    totalTimeMs: number | null;
  };
}

function SnapshotDetail({ run }: SnapshotDetailProps) {
  return (
    <div className="p-6">
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-[--color-text]">{run.characterName}</h2>
        <p className="text-[--color-text-muted]">{run.class} - {run.league}</p>
      </div>

      {/* Timeline scrubber placeholder */}
      <div className="mb-6">
        <div className="h-2 bg-[--color-surface-elevated] rounded-full">
          <div className="h-full w-1/3 bg-[--color-poe-gold] rounded-full" />
        </div>
        <div className="flex justify-between mt-2 text-xs text-[--color-text-muted]">
          <span>Act 1</span>
          <span>Act 5</span>
          <span>Act 10</span>
        </div>
      </div>

      {/* Snapshot tabs */}
      <div className="border-b border-[--color-border] mb-6">
        <div className="flex gap-4">
          {['Equipment', 'Skills', 'Passives', 'Stats'].map((tab) => (
            <button
              key={tab}
              className="pb-2 px-1 text-sm text-[--color-text-muted] hover:text-[--color-text] border-b-2 border-transparent hover:border-[--color-poe-gold]"
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* Equipment grid placeholder */}
      <div className="grid grid-cols-4 gap-4">
        {['Helmet', 'Amulet', 'Weapon', 'Body', 'Gloves', 'Ring 1', 'Ring 2', 'Belt', 'Boots', 'Offhand'].map(
          (slot) => (
            <div
              key={slot}
              className="aspect-square bg-[--color-surface-elevated] rounded-lg border border-[--color-border] flex items-center justify-center"
            >
              <span className="text-xs text-[--color-text-muted]">{slot}</span>
            </div>
          )
        )}
      </div>

      {/* Export button */}
      <div className="mt-6 flex gap-3">
        <button className="px-4 py-2 bg-[--color-poe-gold] text-[--color-poe-darker] rounded-lg font-medium hover:bg-[--color-poe-gold-light] transition-colors">
          Export to PoB
        </button>
        <button className="px-4 py-2 bg-[--color-surface-elevated] text-[--color-text] rounded-lg font-medium hover:bg-[--color-border] transition-colors">
          Share on pobb.in
        </button>
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
