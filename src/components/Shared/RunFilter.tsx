import { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { CustomSelect } from './CustomSelect';
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
        <CustomSelect
          value={filters.class || ''}
          onChange={(v) => onFiltersChange({ class: v || undefined, ascendancy: undefined })}
          className="min-w-[120px]"
          options={[
            { value: '', label: 'All Classes' },
            ...allClasses.map((cls) => ({ value: cls, label: cls })),
          ]}
        />
      </div>

      {/* Ascendancy filter */}
      <div className="flex flex-col gap-1">
        <label className="text-xs text-[--color-text-muted]">Ascendancy</label>
        <CustomSelect
          value={filters.ascendancy || ''}
          onChange={(v) => onFiltersChange({ ascendancy: v || undefined })}
          className="min-w-[120px]"
          disabled={!filters.class}
          options={[
            { value: '', label: 'All Ascendancies' },
            ...availableAscendancies.map((asc) => ({ value: asc, label: asc })),
          ]}
        />
      </div>

      {/* Category filter */}
      <div className="flex flex-col gap-1">
        <label className="text-xs text-[--color-text-muted]">Category</label>
        <CustomSelect
          value={filters.category || ''}
          onChange={(v) => onFiltersChange({ category: v || undefined })}
          className="min-w-[100px]"
          options={[
            { value: '', label: 'All' },
            ...availableCategories.map((cat) => ({ value: cat, label: cat })),
          ]}
        />
      </div>

      {/* League filter */}
      <div className="flex flex-col gap-1">
        <label className="text-xs text-[--color-text-muted]">League</label>
        <CustomSelect
          value={filters.league || ''}
          onChange={(v) => onFiltersChange({ league: v || undefined })}
          className="min-w-[120px]"
          options={[
            { value: '', label: 'All Leagues' },
            ...availableLeagues.map((league) => ({ value: league, label: league })),
          ]}
        />
      </div>

      {/* Preset filter */}
      {showPresetFilter && (
        <div className="flex flex-col gap-1">
          <label className="text-xs text-[--color-text-muted]">Preset</label>
          <CustomSelect
            value={filters.breakpointPreset || ''}
            onChange={(v) => onFiltersChange({ breakpointPreset: v || undefined })}
            className="min-w-[100px]"
            options={[
              { value: '', label: 'All Presets' },
              ...availablePresets.map((preset) => ({ value: preset, label: preset })),
            ]}
          />
        </div>
      )}

      {/* Completed filter */}
      <div className="flex flex-col gap-1">
        <label className="text-xs text-[--color-text-muted]">Status</label>
        <CustomSelect
          value={filters.isCompleted === undefined ? '' : filters.isCompleted ? 'true' : 'false'}
          onChange={(v) => onFiltersChange({ isCompleted: v === '' ? undefined : v === 'true' })}
          className="min-w-[100px]"
          options={[
            { value: '', label: 'All Runs' },
            { value: 'true', label: 'Completed' },
            { value: 'false', label: 'In Progress' },
          ]}
        />
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
