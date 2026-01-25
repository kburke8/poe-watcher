interface PassivesSummaryProps {
  hashes: number[];
  hashesEx: number[];
  characterLevel: number;
}

export function PassivesSummary({ hashes, hashesEx, characterLevel }: PassivesSummaryProps) {
  const totalPassives = hashes.length;
  const ascendancyPassives = hashesEx.length;

  // Calculate expected passives based on level (rough estimate)
  // You get ~1 passive per level after level 1, plus 22 from quests (Acts 1-10)
  const expectedPassives = characterLevel - 1 + Math.min(22, Math.floor(characterLevel / 4));

  return (
    <div className="space-y-6">
      {/* Summary stats */}
      <div className="grid grid-cols-3 gap-4">
        <StatCard
          label="Total Allocated"
          value={totalPassives}
          subtext={`of ~${expectedPassives} expected`}
        />
        <StatCard
          label="Ascendancy"
          value={ascendancyPassives}
          subtext="ascendancy points"
        />
        <StatCard
          label="Character Level"
          value={characterLevel}
          subtext="at snapshot"
        />
      </div>

      {/* Passive tree visualization placeholder */}
      <div className="bg-[--color-surface-elevated] rounded-lg p-6">
        <div className="text-center text-[--color-text-muted]">
          <div className="text-lg mb-2">Passive Tree Visualization</div>
          <p className="text-sm">
            Full passive tree rendering coming in a future update.
          </p>
          <p className="text-xs mt-2">
            {totalPassives} nodes allocated
            {ascendancyPassives > 0 && ` + ${ascendancyPassives} ascendancy`}
          </p>
        </div>
      </div>

      {/* Raw data (collapsible) */}
      <details className="bg-[--color-surface-elevated] rounded-lg">
        <summary className="px-4 py-3 cursor-pointer text-sm text-[--color-text-muted] hover:text-[--color-text]">
          View raw passive node IDs ({totalPassives} nodes)
        </summary>
        <div className="px-4 pb-4">
          <div className="text-xs font-mono text-[--color-text-muted] bg-[--color-surface] rounded p-2 max-h-40 overflow-auto">
            {hashes.join(', ')}
          </div>
          {hashesEx.length > 0 && (
            <>
              <div className="text-xs text-[--color-text-muted] mt-2 mb-1">Ascendancy nodes:</div>
              <div className="text-xs font-mono text-[--color-text-muted] bg-[--color-surface] rounded p-2">
                {hashesEx.join(', ')}
              </div>
            </>
          )}
        </div>
      </details>
    </div>
  );
}

interface StatCardProps {
  label: string;
  value: number;
  subtext: string;
}

function StatCard({ label, value, subtext }: StatCardProps) {
  return (
    <div className="bg-[--color-surface-elevated] rounded-lg p-4 text-center">
      <div className="text-3xl font-bold text-[--color-poe-gold]">{value}</div>
      <div className="text-sm text-[--color-text]">{label}</div>
      <div className="text-xs text-[--color-text-muted]">{subtext}</div>
    </div>
  );
}
