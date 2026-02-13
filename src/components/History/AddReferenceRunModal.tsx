import { useState, useMemo } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useSettingsStore } from '../../stores/settingsStore';
import { CustomSelect } from '../Shared/CustomSelect';
import type { ReferenceRunData, ReferenceSplitData } from '../../types';

interface AddReferenceRunModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
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

const categories = ['any%', 'all-skills', 'all-waypoints', 'glitchless'];

export function AddReferenceRunModal({ isOpen, onClose, onSuccess }: AddReferenceRunModalProps) {
  const { breakpoints, getCurrentPresetName, getEnabledBreakpointNames } = useSettingsStore();

  const [sourceName, setSourceName] = useState('');
  const [characterName, setCharacterName] = useState('');
  const [selectedClass, setSelectedClass] = useState('');
  const [ascendancy, setAscendancy] = useState('');
  const [category, setCategory] = useState('any%');
  const [league, setLeague] = useState('Standard');
  const [useCurrentPreset, setUseCurrentPreset] = useState(true);
  const [customPreset, setCustomPreset] = useState('');
  const [splitTimes, setSplitTimes] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Get enabled breakpoints for the split time inputs
  const enabledBreakpoints = useMemo(() => {
    return breakpoints.filter((bp) => bp.isEnabled);
  }, [breakpoints]);

  // Calculate total time from last split
  const totalTimeMs = useMemo(() => {
    const lastSplit = enabledBreakpoints[enabledBreakpoints.length - 1];
    if (lastSplit && splitTimes[lastSplit.name]) {
      return parseTimeInput(splitTimes[lastSplit.name]);
    }
    return 0;
  }, [enabledBreakpoints, splitTimes]);

  const handleSplitTimeChange = (breakpointName: string, value: string) => {
    setSplitTimes((prev) => ({
      ...prev,
      [breakpointName]: value,
    }));
  };

  const handleSubmit = async () => {
    setError(null);

    // Validation
    if (!sourceName.trim()) {
      setError('Source name is required');
      return;
    }
    if (!selectedClass) {
      setError('Class is required');
      return;
    }

    // Build splits array
    const splits: ReferenceSplitData[] = [];
    for (const bp of enabledBreakpoints) {
      const timeStr = splitTimes[bp.name];
      if (timeStr) {
        const timeMs = parseTimeInput(timeStr);
        if (timeMs > 0) {
          splits.push({
            breakpointName: bp.name,
            breakpointType: bp.type,
            splitTimeMs: timeMs,
          });
        }
      }
    }

    if (splits.length === 0) {
      setError('At least one split time is required');
      return;
    }

    // Calculate total time from last split
    const finalTotalTimeMs = splits[splits.length - 1].splitTimeMs;

    const data: ReferenceRunData = {
      sourceName: sourceName.trim(),
      characterName: characterName.trim() || undefined,
      class: selectedClass,
      ascendancy: ascendancy || undefined,
      category,
      league,
      breakpointPreset: useCurrentPreset ? getCurrentPresetName() : customPreset || undefined,
      enabledBreakpoints: useCurrentPreset
        ? JSON.stringify(getEnabledBreakpointNames())
        : undefined,
      totalTimeMs: finalTotalTimeMs,
      splits,
    };

    setIsSubmitting(true);
    try {
      await invoke('create_reference_run', { data });
      onSuccess();
      onClose();
      // Reset form
      setSourceName('');
      setCharacterName('');
      setSelectedClass('');
      setAscendancy('');
      setCategory('any%');
      setLeague('Standard');
      setSplitTimes({});
    } catch (err) {
      setError(`Failed to create reference run: ${err}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-[--color-surface] rounded-lg w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-[--color-border]">
          <h2 className="text-lg font-semibold text-[--color-text]">Add Reference Run</h2>
          <p className="text-sm text-[--color-text-muted]">
            Enter split times from an external source (world record, friend's PB, etc.)
          </p>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-4 space-y-4">
          {/* Error message */}
          {error && (
            <div className="p-3 bg-[--color-timer-behind]/20 text-[--color-timer-behind] rounded-lg text-sm">
              {error}
            </div>
          )}

          {/* Source name */}
          <div>
            <label className="block text-sm text-[--color-text-muted] mb-1">
              Source Name *
            </label>
            <input
              type="text"
              value={sourceName}
              onChange={(e) => setSourceName(e.target.value)}
              placeholder="e.g., Havoc WR, Darkee PB"
              className="w-full px-3 py-2 bg-[--color-surface-elevated] border border-[--color-border] rounded-lg text-[--color-text]"
            />
          </div>

          {/* Character name (optional) */}
          <div>
            <label className="block text-sm text-[--color-text-muted] mb-1">
              Character Name (optional)
            </label>
            <input
              type="text"
              value={characterName}
              onChange={(e) => setCharacterName(e.target.value)}
              placeholder="e.g., HavocSpeedrun"
              className="w-full px-3 py-2 bg-[--color-surface-elevated] border border-[--color-border] rounded-lg text-[--color-text]"
            />
          </div>

          {/* Class and Ascendancy */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-[--color-text-muted] mb-1">Class *</label>
              <CustomSelect
                value={selectedClass}
                onChange={(v) => { setSelectedClass(v); setAscendancy(''); }}
                options={[
                  { value: '', label: 'Select class...' },
                  ...Object.keys(classAscendancies).map((cls) => ({ value: cls, label: cls })),
                ]}
              />
            </div>
            <div>
              <label className="block text-sm text-[--color-text-muted] mb-1">Ascendancy</label>
              <CustomSelect
                value={ascendancy}
                onChange={(v) => setAscendancy(v)}
                disabled={!selectedClass}
                options={[
                  { value: '', label: 'None' },
                  ...(selectedClass ? (classAscendancies[selectedClass] || []).map((asc) => ({ value: asc, label: asc })) : []),
                ]}
              />
            </div>
          </div>

          {/* Category and League */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-[--color-text-muted] mb-1">Category</label>
              <CustomSelect
                value={category}
                onChange={(v) => setCategory(v)}
                options={categories.map((cat) => ({ value: cat, label: cat }))}
              />
            </div>
            <div>
              <label className="block text-sm text-[--color-text-muted] mb-1">League</label>
              <input
                type="text"
                value={league}
                onChange={(e) => setLeague(e.target.value)}
                className="w-full px-3 py-2 bg-[--color-surface-elevated] border border-[--color-border] rounded-lg text-[--color-text]"
              />
            </div>
          </div>

          {/* Preset */}
          <div>
            <label className="flex items-center gap-2 mb-2">
              <input
                type="checkbox"
                checked={useCurrentPreset}
                onChange={(e) => setUseCurrentPreset(e.target.checked)}
                className="w-4 h-4 rounded"
              />
              <span className="text-sm text-[--color-text]">
                Use current breakpoint preset ({getCurrentPresetName()})
              </span>
            </label>
            {!useCurrentPreset && (
              <input
                type="text"
                value={customPreset}
                onChange={(e) => setCustomPreset(e.target.value)}
                placeholder="Custom preset name"
                className="w-full px-3 py-2 bg-[--color-surface-elevated] border border-[--color-border] rounded-lg text-[--color-text]"
              />
            )}
          </div>

          {/* Split times */}
          <div>
            <label className="block text-sm text-[--color-text-muted] mb-2">
              Split Times (format: MM:SS or HH:MM:SS)
            </label>
            <div className="space-y-2 max-h-[300px] overflow-auto">
              {enabledBreakpoints.map((bp) => (
                <div key={bp.name} className="flex items-center gap-3">
                  <span className="text-sm text-[--color-text] w-48 truncate" title={bp.name}>
                    {bp.name}
                  </span>
                  <input
                    type="text"
                    value={splitTimes[bp.name] || ''}
                    onChange={(e) => handleSplitTimeChange(bp.name, e.target.value)}
                    placeholder="MM:SS"
                    className="w-24 px-2 py-1 bg-[--color-surface-elevated] border border-[--color-border] rounded text-[--color-text] text-sm timer-display text-center"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Total time preview */}
          {totalTimeMs > 0 && (
            <div className="p-3 bg-[--color-surface-elevated] rounded-lg">
              <span className="text-sm text-[--color-text-muted]">Total Time: </span>
              <span className="timer-display text-[--color-poe-gold]">
                {formatTime(totalTimeMs)}
              </span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[--color-border] flex justify-end gap-3">
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2 text-[--color-text-muted] hover:text-[--color-text] disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="px-4 py-2 bg-[--color-poe-gold] text-[--color-poe-darker] font-semibold rounded-lg hover:bg-[--color-poe-gold-light] disabled:opacity-50"
          >
            {isSubmitting ? 'Creating...' : 'Create Reference Run'}
          </button>
        </div>
      </div>
    </div>
  );
}

function parseTimeInput(input: string): number {
  // Parse MM:SS or HH:MM:SS format to milliseconds
  const parts = input.trim().split(':').map(Number);
  if (parts.some(isNaN)) return 0;

  if (parts.length === 2) {
    // MM:SS
    const [minutes, seconds] = parts;
    return (minutes * 60 + seconds) * 1000;
  } else if (parts.length === 3) {
    // HH:MM:SS
    const [hours, minutes, seconds] = parts;
    return (hours * 3600 + minutes * 60 + seconds) * 1000;
  }

  return 0;
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
