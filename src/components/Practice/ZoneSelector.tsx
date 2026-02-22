import { useState, useMemo } from 'react';
import { MapPin, Route, Plus, X, ChevronUp, ChevronDown, Play, Trash2 } from 'lucide-react';
import { usePracticeStore } from '../../stores/practiceStore';
import { defaultBreakpoints } from '../../config/breakpoints';
import { Button } from '../Shared/Button';
import type { PracticeZone } from '../../types';

// Build a flat list of selectable zones from the breakpoints config
function getSelectableZones(): PracticeZone[] {
  const zones: PracticeZone[] = [];
  for (const bp of defaultBreakpoints) {
    // Only include zone-trigger breakpoints (not level milestones or kitava triggers)
    if (bp.trigger.type === 'zone' && bp.trigger.zoneName && bp.trigger.act) {
      zones.push({
        name: bp.name,
        zoneName: bp.trigger.zoneName,
        act: bp.trigger.act,
      });
    }
  }
  return zones;
}

const allZones = getSelectableZones();
const actNumbers = [...new Set(allZones.map(z => z.act))].sort((a, b) => a - b);

export function ZoneSelector() {
  const { mode, setMode, selectedZones, addZone, removeZone, moveZone, clearZones, startPractice } = usePracticeStore();
  const [search, setSearch] = useState('');
  const [actFilter, setActFilter] = useState<number | null>(null);

  const filteredZones = useMemo(() => {
    let zones = allZones;
    if (actFilter !== null) {
      zones = zones.filter(z => z.act === actFilter);
    }
    if (search) {
      const lower = search.toLowerCase();
      zones = zones.filter(z => z.name.toLowerCase().includes(lower) || z.zoneName.toLowerCase().includes(lower));
    }
    return zones;
  }, [search, actFilter]);

  const selectedZoneNames = new Set(selectedZones.map(z => `${z.zoneName}-${z.act}`));

  return (
    <div className="flex flex-col gap-4 h-full min-h-0">
      {/* Mode toggle */}
      <div className="flex gap-2">
        <button
          onClick={() => setMode('single_zone')}
          className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg border transition-all ${
            mode === 'single_zone'
              ? 'border-[--color-poe-gold] bg-[--color-poe-gold]/10 text-[--color-poe-gold]'
              : 'border-[--color-border] text-[--color-text-muted] hover:border-[--color-poe-gold]/40 hover:text-[--color-text]'
          }`}
        >
          <MapPin className="w-4 h-4" />
          <div className="text-left">
            <div className="font-semibold text-sm">Single Zone</div>
            <div className="text-xs opacity-70">Repeat one zone</div>
          </div>
        </button>
        <button
          onClick={() => setMode('route')}
          className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg border transition-all ${
            mode === 'route'
              ? 'border-[--color-poe-gold] bg-[--color-poe-gold]/10 text-[--color-poe-gold]'
              : 'border-[--color-border] text-[--color-text-muted] hover:border-[--color-poe-gold]/40 hover:text-[--color-text]'
          }`}
        >
          <Route className="w-4 h-4" />
          <div className="text-left">
            <div className="font-semibold text-sm">Route Practice</div>
            <div className="text-xs opacity-70">Run consecutive zones</div>
          </div>
        </button>
      </div>

      {/* Selected zones summary */}
      {selectedZones.length > 0 && (
        <div className="card-inset rounded-lg p-3">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-[--color-text]">
              {mode === 'single_zone' ? 'Target Zone' : `Route (${selectedZones.length} zones)`}
            </h3>
            <div className="flex gap-1">
              <button
                onClick={clearZones}
                className="p-1 rounded text-[--color-text-muted] hover:text-red-400 transition-colors"
                title="Clear selection"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
          <div className="flex flex-col gap-1 max-h-32 overflow-auto">
            {selectedZones.map((zone, index) => (
              <div key={`${zone.zoneName}-${zone.act}`} className="flex items-center gap-2 text-sm">
                {mode === 'route' && (
                  <span className="text-[--color-text-muted] w-5 text-right text-xs">{index + 1}.</span>
                )}
                <span className="text-[--color-poe-gold] text-xs">A{zone.act}</span>
                <span className="text-[--color-text] flex-1 truncate">{zone.name}</span>
                {mode === 'route' && selectedZones.length > 1 && (
                  <div className="flex gap-0.5">
                    <button
                      onClick={() => moveZone(index, 'up')}
                      disabled={index === 0}
                      className="p-0.5 text-[--color-text-muted] hover:text-[--color-text] disabled:opacity-30"
                    >
                      <ChevronUp className="w-3 h-3" />
                    </button>
                    <button
                      onClick={() => moveZone(index, 'down')}
                      disabled={index === selectedZones.length - 1}
                      className="p-0.5 text-[--color-text-muted] hover:text-[--color-text] disabled:opacity-30"
                    >
                      <ChevronDown className="w-3 h-3" />
                    </button>
                  </div>
                )}
                <button
                  onClick={() => removeZone(zone.zoneName)}
                  className="p-0.5 text-[--color-text-muted] hover:text-red-400 transition-colors"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>

          <Button
            variant="primary"
            size="md"
            icon={Play}
            onClick={startPractice}
            className="w-full mt-3"
            style={{ background: 'linear-gradient(180deg, #2cc660 0%, #189845 100%)', borderColor: '#44d070', color: 'white', boxShadow: '0 0 14px rgba(34, 197, 94, 0.3), inset 0 1px 0 rgba(255,255,255,0.15)' }}
          >
            Start Practice
          </Button>
        </div>
      )}

      {/* Zone list with search and filter */}
      <div className="flex flex-col gap-2 flex-1 min-h-0">
        <div className="flex gap-2">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search zones..."
            className="flex-1 px-3 py-1.5 rounded-lg bg-[--color-surface] border border-[--color-border] text-[--color-text] text-sm placeholder:text-[--color-text-muted] focus:outline-none focus:border-[--color-poe-gold]/50"
          />
        </div>

        {/* Act filter chips */}
        <div className="flex gap-1 flex-wrap">
          <button
            onClick={() => setActFilter(null)}
            className={`px-2 py-0.5 rounded text-xs transition-colors ${
              actFilter === null
                ? 'bg-[--color-poe-gold]/20 text-[--color-poe-gold] border border-[--color-poe-gold]/40'
                : 'text-[--color-text-muted] border border-[--color-border] hover:text-[--color-text]'
            }`}
          >
            All
          </button>
          {actNumbers.map(act => (
            <button
              key={act}
              onClick={() => setActFilter(actFilter === act ? null : act)}
              className={`px-2 py-0.5 rounded text-xs transition-colors ${
                actFilter === act
                  ? 'bg-[--color-poe-gold]/20 text-[--color-poe-gold] border border-[--color-poe-gold]/40'
                  : 'text-[--color-text-muted] border border-[--color-border] hover:text-[--color-text]'
              }`}
            >
              A{act}
            </button>
          ))}
        </div>

        {/* Zone list */}
        <div className="flex-1 overflow-auto card-inset rounded-lg">
          <div className="divide-y divide-[--color-border]">
            {filteredZones.map((zone) => {
              const isSelected = selectedZoneNames.has(`${zone.zoneName}-${zone.act}`);
              return (
                <button
                  key={`${zone.zoneName}-${zone.act}`}
                  onClick={() => {
                    if (isSelected) {
                      removeZone(zone.zoneName);
                    } else {
                      addZone(zone);
                    }
                  }}
                  className={`w-full flex items-center gap-3 px-3 py-2 text-left transition-colors ${
                    isSelected
                      ? 'bg-[--color-poe-gold]/10 text-[--color-text]'
                      : 'hover:bg-[--color-surface-elevated] text-[--color-text-muted]'
                  }`}
                >
                  <span className="text-xs text-[--color-poe-gold] w-6">A{zone.act}</span>
                  <span className={`flex-1 text-sm ${isSelected ? 'text-[--color-text] font-medium' : ''}`}>
                    {zone.name}
                  </span>
                  {isSelected ? (
                    <X className="w-3.5 h-3.5 text-[--color-text-muted]" />
                  ) : (
                    <Plus className="w-3.5 h-3.5" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
