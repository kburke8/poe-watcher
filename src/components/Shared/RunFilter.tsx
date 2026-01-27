import { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import type { RunFilters, Run } from '../../types';

interface RunFilterProps {
  filters: RunFilters;
  onFiltersChange: (filters: Partial<RunFilters>) => void;
  onClear: () => void;
  showPresetFilter?: boolean;
  showReferenceToggle?: boolean;
}

// POE class/ascendancy mapping
const classAscendancies: Record<string, string[]> = {
  Marauder: ['Juggernaut', 'Berserker', 'Chieftain'],
  Ranger: ['Raider', 'Deadeye', 'Pathfinder', 'Warden'],
  Witch: ['Occultist', 'Elementalist', 'Necromancer'],
  Duelist: ['Slayer', 'Gladiator', 'Champion'],
  Templar: ['Inquisitor', 'Hierophant', 'Guardian'],
  Shadow: ['Assassin', 'Trickster', 'Saboteur'],
  Scion: ['Ascendant'],
};

const allClasses = Object.keys(classAscendancies);

export function RunFilter({
  filters,
  onFiltersChange,
  onClear,
  showPresetFilter = true,
  showReferenceToggle = false,
}: RunFilterProps) {
  const [availableLeagues, setAvailableLeagues] = useState<string[]>([]);
  const [availableCategories, setAvailableCategories] = useState<string[]>([]);
  const [availablePresets, setAvailablePresets] = useState<string[]>([]);

  // Load distinct values from existing runs
  useEffect(() => {
    const loadDistinctValues = async () => {
      try {
        const runs = await invoke<Run[]>('get_runs');

        // Extract unique leagues
        const leagues = [...new Set(runs.map((r) => r.league).filter(Boolean))] as string[];
        setAvailableLeagues(leagues.sort());

        // Extract unique categories
        const categories = [...new Set(runs.map((r) => r.category))] as string[];
        setAvailableCategories(categories.sort());

        // Extract unique presets
        const presets = [...new Set(
          runs.map((r) => r.breakpointPreset).filter(Boolean)
        )] as string[];
        setAvailablePresets(presets.sort());
      } catch (error) {
        console.error('[RunFilter] Failed to load distinct values:', error);
      }
    };

    loadDistinctValues();
  }, []);

  // Get available ascendancies based on selected class
  const availableAscendancies = filters.class
    ? classAscendancies[filters.class] || []
    : Object.values(classAscendancies).flat();

  // Check if any filters are active
  const hasActiveFilters =
    filters.class ||
    filters.ascendancy ||
    filters.category ||
    filters.league ||
    filters.breakpointPreset ||
    filters.isCompleted !== undefined;

  return (
    <div className="flex flex-wrap items-center gap-3 p-3 bg-[--color-surface] rounded-lg border border-[--color-border]">
      {/* Class filter */}
      <div className="flex flex-col gap-1">
        <label className="text-xs text-[--color-text-muted]">Class</label>
        <select
          value={filters.class || ''}
          onChange={(e) => {
            const newClass = e.target.value || undefined;
            onFiltersChange({
              class: newClass,
              // Clear ascendancy if class changes
              ascendancy: undefined,
            });
          }}
          className="px-2 py-1.5 bg-[--color-surface-elevated] border border-[--color-border] rounded text-[--color-text] text-sm min-w-[120px]"
        >
          <option value="">All Classes</option>
          {allClasses.map((cls) => (
            <option key={cls} value={cls}>
              {cls}
            </option>
          ))}
        </select>
      </div>

      {/* Ascendancy filter */}
      <div className="flex flex-col gap-1">
        <label className="text-xs text-[--color-text-muted]">Ascendancy</label>
        <select
          value={filters.ascendancy || ''}
          onChange={(e) => onFiltersChange({ ascendancy: e.target.value || undefined })}
          className="px-2 py-1.5 bg-[--color-surface-elevated] border border-[--color-border] rounded text-[--color-text] text-sm min-w-[120px]"
          disabled={!filters.class}
        >
          <option value="">All Ascendancies</option>
          {availableAscendancies.map((asc) => (
            <option key={asc} value={asc}>
              {asc}
            </option>
          ))}
        </select>
      </div>

      {/* Category filter */}
      <div className="flex flex-col gap-1">
        <label className="text-xs text-[--color-text-muted]">Category</label>
        <select
          value={filters.category || ''}
          onChange={(e) => onFiltersChange({ category: e.target.value || undefined })}
          className="px-2 py-1.5 bg-[--color-surface-elevated] border border-[--color-border] rounded text-[--color-text] text-sm min-w-[100px]"
        >
          <option value="">All</option>
          {availableCategories.map((cat) => (
            <option key={cat} value={cat}>
              {cat}
            </option>
          ))}
        </select>
      </div>

      {/* League filter */}
      <div className="flex flex-col gap-1">
        <label className="text-xs text-[--color-text-muted]">League</label>
        <select
          value={filters.league || ''}
          onChange={(e) => onFiltersChange({ league: e.target.value || undefined })}
          className="px-2 py-1.5 bg-[--color-surface-elevated] border border-[--color-border] rounded text-[--color-text] text-sm min-w-[120px]"
        >
          <option value="">All Leagues</option>
          {availableLeagues.map((league) => (
            <option key={league} value={league}>
              {league}
            </option>
          ))}
        </select>
      </div>

      {/* Preset filter */}
      {showPresetFilter && (
        <div className="flex flex-col gap-1">
          <label className="text-xs text-[--color-text-muted]">Preset</label>
          <select
            value={filters.breakpointPreset || ''}
            onChange={(e) => onFiltersChange({ breakpointPreset: e.target.value || undefined })}
            className="px-2 py-1.5 bg-[--color-surface-elevated] border border-[--color-border] rounded text-[--color-text] text-sm min-w-[100px]"
          >
            <option value="">All Presets</option>
            {availablePresets.map((preset) => (
              <option key={preset} value={preset}>
                {preset}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Completed filter */}
      <div className="flex flex-col gap-1">
        <label className="text-xs text-[--color-text-muted]">Status</label>
        <select
          value={filters.isCompleted === undefined ? '' : filters.isCompleted ? 'true' : 'false'}
          onChange={(e) => {
            const value = e.target.value;
            onFiltersChange({
              isCompleted: value === '' ? undefined : value === 'true',
            });
          }}
          className="px-2 py-1.5 bg-[--color-surface-elevated] border border-[--color-border] rounded text-[--color-text] text-sm min-w-[100px]"
        >
          <option value="">All Runs</option>
          <option value="true">Completed</option>
          <option value="false">In Progress</option>
        </select>
      </div>

      {/* Reference runs toggle */}
      {showReferenceToggle && (
        <div className="flex flex-col gap-1">
          <label className="text-xs text-[--color-text-muted]">Reference</label>
          <label className="flex items-center gap-2 px-2 py-1.5">
            <input
              type="checkbox"
              checked={filters.includeReference || false}
              onChange={(e) => onFiltersChange({ includeReference: e.target.checked })}
              className="w-4 h-4 rounded border-[--color-border] text-[--color-poe-gold] focus:ring-[--color-poe-gold]"
            />
            <span className="text-sm text-[--color-text]">Include</span>
          </label>
        </div>
      )}

      {/* Clear filters button */}
      {hasActiveFilters && (
        <button
          onClick={onClear}
          className="mt-auto px-3 py-1.5 text-sm text-[--color-text-muted] hover:text-[--color-text] hover:bg-[--color-surface-elevated] rounded transition-colors"
        >
          Clear Filters
        </button>
      )}
    </div>
  );
}
