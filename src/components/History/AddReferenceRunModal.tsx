import { useState, useMemo, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useSettingsStore } from '../../stores/settingsStore';
import { CustomSelect } from '../Shared/CustomSelect';
import { SplitTimeEditor, msToDigits, msToShortDigits, parseDigitsToMs, parseShortDigitsToMs, formatTime } from '../Shared/SplitTimeEditor';
import type { Run, Split, ReferenceRunData, ReferenceSplitData } from '../../types';

interface AddReferenceRunModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  editRunId?: number;
  editRun?: Run;
  editSplits?: Split[];
}

// PoE class/ascendancy mapping
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

export function AddReferenceRunModal({ isOpen, onClose, onSuccess, editRunId, editRun, editSplits }: AddReferenceRunModalProps) {
  const { breakpoints, getCurrentPresetName, getEnabledBreakpointNames } = useSettingsStore();
  const isEditing = !!editRun;

  const [sourceName, setSourceName] = useState('');
  const [selectedClass, setSelectedClass] = useState('');
  const [ascendancy, setAscendancy] = useState('');
  const [category, setCategory] = useState('any%');
  const [league, setLeague] = useState('Standard');
  const [useCurrentPreset, setUseCurrentPreset] = useState(true);
  const [customPreset, setCustomPreset] = useState('');
  const [splitTimes, setSplitTimes] = useState<Record<string, string>>({});
  const [bossTimes, setBossTimes] = useState<Record<string, string>>({});
  const [townTimes, setTownTimes] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Pre-populate fields when editing
  useEffect(() => {
    if (isOpen && editRun && editSplits) {
      setSourceName(editRun.sourceName || '');
      setSelectedClass(editRun.class || '');
      setAscendancy(editRun.ascendancy || '');
      setCategory(editRun.category || 'any%');
      setLeague(editRun.league || 'Standard');

      const times: Record<string, string> = {};
      const bosses: Record<string, string> = {};
      const towns: Record<string, string> = {};
      let prevTownMs = 0;
      for (const split of editSplits) {
        times[split.breakpointName] = msToDigits(split.splitTimeMs);
        if (split.bossFightMs > 0) {
          bosses[split.breakpointName] = msToShortDigits(split.bossFightMs);
        }
        // townTimeMs is stored cumulatively; convert back to per-segment for editing
        const segmentTownMs = (split.townTimeMs ?? 0) - prevTownMs;
        if (segmentTownMs > 0) {
          towns[split.breakpointName] = msToShortDigits(segmentTownMs);
        }
        prevTownMs = split.townTimeMs ?? 0;
      }
      setSplitTimes(times);
      setBossTimes(bosses);
      setTownTimes(towns);
    }
  }, [isOpen, editRun, editSplits]);

  const enabledBreakpoints = useMemo(() => {
    return breakpoints.filter((bp) => bp.isEnabled);
  }, [breakpoints]);

  const totalTimeMs = useMemo(() => {
    for (let i = enabledBreakpoints.length - 1; i >= 0; i--) {
      const time = splitTimes[enabledBreakpoints[i].name];
      if (time) return parseDigitsToMs(time);
    }
    return 0;
  }, [enabledBreakpoints, splitTimes]);

  const handleSubmit = async () => {
    setError(null);

    if (!sourceName.trim()) {
      setError('Source name is required');
      return;
    }
    if (!selectedClass) {
      setError('Class is required');
      return;
    }

    const splits: ReferenceSplitData[] = [];
    for (const bp of enabledBreakpoints) {
      const digits = splitTimes[bp.name];
      if (digits) {
        const timeMs = parseDigitsToMs(digits);
        if (timeMs > 0) {
          const bossDigits = bossTimes[bp.name];
          const townDigits = townTimes[bp.name];
          splits.push({
            breakpointName: bp.name,
            breakpointType: bp.type,
            splitTimeMs: timeMs,
            bossFightMs: bossDigits ? parseShortDigitsToMs(bossDigits) : 0,
            townTimeMs: townDigits ? parseShortDigitsToMs(townDigits) : 0,
          });
        }
      }
    }

    if (splits.length === 0) {
      setError('At least one split time is required');
      return;
    }

    const finalTotalTimeMs = splits[splits.length - 1].splitTimeMs;

    const data: ReferenceRunData = {
      sourceName: sourceName.trim(),
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
      if (isEditing && editRunId) {
        await invoke('update_reference_run', { runId: editRunId, data });
      } else {
        await invoke('create_reference_run', { data });
      }
      onSuccess();
      onClose();
      setSourceName('');
      setSelectedClass('');
      setAscendancy('');
      setCategory('any%');
      setLeague('Standard');
      setSplitTimes({});
      setBossTimes({});
      setTownTimes({});
    } catch (err) {
      setError(`Failed to ${isEditing ? 'update' : 'create'} reference run: ${err}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const selectedCount = enabledBreakpoints.filter(bp => splitTimes[bp.name]).length;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-[#1c1916] border border-[--color-border] rounded-lg w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
        {/* Header */}
        <div className="p-4 border-b border-[--color-border]">
          <h2 className="text-lg font-semibold text-[--color-text]">{isEditing ? 'Edit Reference Run' : 'Add Reference Run'}</h2>
          <p className="text-sm text-[--color-text-muted]">
            {isEditing ? 'Modify split times and metadata for this reference run' : 'Enter split times from an external source (world record, friend\'s PB, etc.)'}
          </p>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-4 space-y-4">
          {error && (
            <div className="p-3 bg-[--color-timer-behind]/20 text-[--color-timer-behind] rounded-lg text-sm">
              {error}
            </div>
          )}

          {/* Source name */}
          <div>
            <label className="block text-sm text-[--color-text-muted] mb-1">Source Name *</label>
            <input
              type="text"
              value={sourceName}
              onChange={(e) => setSourceName(e.target.value)}
              placeholder="e.g., World Record, Goal Time"
              className="w-full px-3 py-2 bg-[--color-surface-elevated] border border-[--color-border] rounded-lg text-[--color-text] text-sm"
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
                className="w-full px-3 py-2 bg-[--color-surface-elevated] border border-[--color-border] rounded-lg text-[--color-text] text-sm"
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
                className="w-full px-3 py-2 bg-[--color-surface-elevated] border border-[--color-border] rounded-lg text-[--color-text] text-sm"
              />
            )}
          </div>

          {/* Split times */}
          <SplitTimeEditor
            breakpoints={enabledBreakpoints}
            splitTimes={splitTimes}
            setSplitTimes={setSplitTimes}
            bossTimes={bossTimes}
            setBossTimes={setBossTimes}
            townTimes={townTimes}
            setTownTimes={setTownTimes}
          />

          {/* Total time preview */}
          {totalTimeMs > 0 && (
            <div className="p-3 bg-[--color-surface-elevated] rounded-lg flex items-center justify-between">
              <span className="text-sm text-[--color-text-muted]">
                {selectedCount} split{selectedCount !== 1 ? 's' : ''} entered
              </span>
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
            className="px-4 py-2 text-[--color-text-muted] hover:text-[--color-text] disabled:opacity-50 text-sm"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="px-4 py-2 bg-[--color-poe-gold] text-[--color-poe-darker] font-semibold rounded-lg hover:bg-[--color-poe-gold-light] disabled:opacity-50 text-sm"
          >
            {isSubmitting ? (isEditing ? 'Saving...' : 'Creating...') : (isEditing ? 'Save' : 'Create Reference Run')}
          </button>
        </div>
      </div>
    </div>
  );
}
