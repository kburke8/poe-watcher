import { useState, useMemo, useRef, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useSettingsStore } from '../../stores/settingsStore';
import { getWizardCategory } from '../../config/wizardRoutes';
import { SplitTimeEditor, msToDigits, msToShortDigits, parseDigitsToMs, parseShortDigitsToMs, formatTime } from '../Shared/SplitTimeEditor';
import type { Run, Split, ReferenceRunData, ReferenceSplitData } from '../../types';

interface AddComparisonModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  editRunId?: number;
  editRun?: Run;
  editSplits?: Split[];
}

export function AddComparisonModal({ isOpen, onClose, onSuccess, editRunId, editRun, editSplits }: AddComparisonModalProps) {
  const { breakpoints, wizardConfig, getCurrentPresetName, getEnabledBreakpointNames, setActiveComparison } = useSettingsStore();
  const isEditing = !!editRun;

  const [name, setName] = useState('');
  const [splitTimes, setSplitTimes] = useState<Record<string, string>>({});
  const [bossTimes, setBossTimes] = useState<Record<string, string>>({});
  const [townTimes, setTownTimes] = useState<Record<string, string>>({});
  const [enabledSplits, setEnabledSplits] = useState<Set<string>>(new Set());
  const [setAsActive, setSetAsActive] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const enabledBreakpoints = useMemo(() => {
    return breakpoints.filter((bp) => bp.isEnabled);
  }, [breakpoints]);

  // Initialize enabled splits when modal opens (new mode only)
  const wasOpen = useRef(false);
  useEffect(() => {
    if (isOpen && !wasOpen.current && !isEditing) {
      setEnabledSplits(new Set(enabledBreakpoints.map(bp => bp.name)));
    }
    wasOpen.current = isOpen;
  }, [isOpen, enabledBreakpoints, isEditing]);

  // Pre-populate fields when editing
  useEffect(() => {
    if (isOpen && editRun && editSplits) {
      setName(editRun.sourceName || '');

      const times: Record<string, string> = {};
      const bosses: Record<string, string> = {};
      const towns: Record<string, string> = {};
      const enabled = new Set<string>();

      let prevTownMs = 0;
      for (const split of editSplits) {
        enabled.add(split.breakpointName);
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

      setEnabledSplits(enabled);
      setSplitTimes(times);
      setBossTimes(bosses);
      setTownTimes(towns);
    }
  }, [isOpen, editRun, editSplits]);

  const toggleSplit = (name: string) => {
    setEnabledSplits(prev => {
      const next = new Set(prev);
      if (next.has(name)) {
        next.delete(name);
        setSplitTimes(prev => { const copy = { ...prev }; delete copy[name]; return copy; });
        setBossTimes(prev => { const copy = { ...prev }; delete copy[name]; return copy; });
        setTownTimes(prev => { const copy = { ...prev }; delete copy[name]; return copy; });
      } else {
        next.add(name);
      }
      return next;
    });
  };

  const toggleAll = () => {
    const allNames = enabledBreakpoints.map(bp => bp.name);
    if (enabledSplits.size === allNames.length) {
      setEnabledSplits(new Set());
      setSplitTimes({});
      setBossTimes({});
      setTownTimes({});
    } else {
      setEnabledSplits(new Set(allNames));
    }
  };

  const totalTimeMs = useMemo(() => {
    const enabledBps = enabledBreakpoints.filter(bp => enabledSplits.has(bp.name));
    for (let i = enabledBps.length - 1; i >= 0; i--) {
      const time = splitTimes[enabledBps[i].name];
      if (time) return parseDigitsToMs(time);
    }
    return 0;
  }, [enabledBreakpoints, enabledSplits, splitTimes]);

  const handleSubmit = async () => {
    setError(null);

    if (!name.trim()) {
      setError('Name is required');
      return;
    }

    const splits: ReferenceSplitData[] = [];
    for (const bp of enabledBreakpoints) {
      if (!enabledSplits.has(bp.name)) continue;
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
      setError('Enter at least one split time');
      return;
    }

    const category = wizardConfig ? getWizardCategory(wizardConfig) : 'any%';
    const finalTotalTimeMs = splits[splits.length - 1].splitTimeMs;

    const data: ReferenceRunData = {
      sourceName: name.trim(),
      class: 'Unknown',
      category,
      breakpointPreset: getCurrentPresetName(),
      enabledBreakpoints: JSON.stringify(getEnabledBreakpointNames()),
      totalTimeMs: finalTotalTimeMs,
      splits,
    };

    setIsSubmitting(true);
    try {
      if (isEditing && editRunId) {
        await invoke('update_reference_run', { runId: editRunId, data });
        if (setAsActive) setActiveComparison(editRunId, name.trim());
      } else {
        const runId = await invoke<number>('create_reference_run', { data });
        if (setAsActive) setActiveComparison(runId, name.trim());
      }

      onSuccess();
      onClose();
      setName('');
      setSplitTimes({});
      setBossTimes({});
      setTownTimes({});
      setEnabledSplits(new Set());
      setSetAsActive(true);
    } catch (err) {
      setError(`Failed to ${isEditing ? 'update' : 'create'} comparison: ${err}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const allSelected = enabledSplits.size === enabledBreakpoints.length;
  const selectedCount = enabledBreakpoints.filter(bp => enabledSplits.has(bp.name) && splitTimes[bp.name]).length;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-[#1c1916] border border-[--color-border] rounded-lg w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col shadow-2xl">
        {/* Header */}
        <div className="p-4 border-b border-[--color-border]">
          <h2 className="text-lg font-semibold text-[--color-text]">{isEditing ? 'Edit Comparison Run' : 'Add Comparison Run'}</h2>
          <p className="text-sm text-[--color-text-muted]">
            {isEditing ? 'Modify split times for this comparison run' : 'Enter split times to compare against during runs'}
          </p>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-4 space-y-4">
          {error && (
            <div className="p-3 bg-[--color-timer-behind]/20 text-[--color-timer-behind] rounded-lg text-sm">
              {error}
            </div>
          )}

          {/* Name */}
          <div>
            <label className="block text-sm text-[--color-text-muted] mb-1">Name *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Goal Time, PB Target"
              className="w-full px-3 py-2 bg-[--color-surface-elevated] border border-[--color-border] rounded-lg text-[--color-text] text-sm"
              autoFocus
            />
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
            enabledSplits={enabledSplits}
            onToggleSplit={toggleSplit}
            onToggleAll={toggleAll}
            allSelected={allSelected}
          />

          {/* Set as active */}
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={setAsActive}
              onChange={(e) => setSetAsActive(e.target.checked)}
              className="w-4 h-4 rounded"
            />
            <span className="text-sm text-[--color-text]">Set as active comparison</span>
          </label>

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
            {isSubmitting ? (isEditing ? 'Saving...' : 'Creating...') : (isEditing ? 'Save' : 'Create')}
          </button>
        </div>
      </div>
    </div>
  );
}
