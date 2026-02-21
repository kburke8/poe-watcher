import { useState, useMemo, useRef, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useSettingsStore } from '../../stores/settingsStore';
import { getWizardCategory } from '../../config/wizardRoutes';
import type { ReferenceRunData, ReferenceSplitData } from '../../types';

interface AddComparisonModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function AddComparisonModal({ isOpen, onClose, onSuccess }: AddComparisonModalProps) {
  const { breakpoints, wizardConfig, getCurrentPresetName, getEnabledBreakpointNames, setActiveComparison } = useSettingsStore();

  const [name, setName] = useState('');
  const [splitTimes, setSplitTimes] = useState<Record<string, string>>({});
  const [enabledSplits, setEnabledSplits] = useState<Set<string>>(new Set());
  const [setAsActive, setSetAsActive] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const enabledBreakpoints = useMemo(() => {
    return breakpoints.filter((bp) => bp.isEnabled);
  }, [breakpoints]);

  // Initialize enabled splits when modal opens
  const wasOpen = useRef(false);
  useEffect(() => {
    if (isOpen && !wasOpen.current) {
      setEnabledSplits(new Set(enabledBreakpoints.map(bp => bp.name)));
    }
    wasOpen.current = isOpen;
  }, [isOpen, enabledBreakpoints]);

  const toggleSplit = (name: string) => {
    setEnabledSplits(prev => {
      const next = new Set(prev);
      if (next.has(name)) {
        next.delete(name);
        // Also clear the time input
        setSplitTimes(prev => {
          const copy = { ...prev };
          delete copy[name];
          return copy;
        });
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
    } else {
      setEnabledSplits(new Set(allNames));
    }
  };

  const handleSplitTimeChange = (breakpointName: string, value: string) => {
    setSplitTimes(prev => ({ ...prev, [breakpointName]: value }));
  };

  const totalTimeMs = useMemo(() => {
    // Find last enabled breakpoint with a time
    const enabledBps = enabledBreakpoints.filter(bp => enabledSplits.has(bp.name));
    for (let i = enabledBps.length - 1; i >= 0; i--) {
      const time = splitTimes[enabledBps[i].name];
      if (time) {
        return parseTimeInput(time);
      }
    }
    return 0;
  }, [enabledBreakpoints, enabledSplits, splitTimes]);

  const handleSubmit = async () => {
    setError(null);

    if (!name.trim()) {
      setError('Name is required');
      return;
    }

    // Build splits array from enabled splits with times
    const splits: ReferenceSplitData[] = [];
    for (const bp of enabledBreakpoints) {
      if (!enabledSplits.has(bp.name)) continue;
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
      const runId = await invoke<number>('create_reference_run', { data });

      if (setAsActive) {
        setActiveComparison(runId, name.trim());
      }

      onSuccess();
      onClose();
      // Reset form
      setName('');
      setSplitTimes({});
      setEnabledSplits(new Set());
      setSetAsActive(true);
    } catch (err) {
      setError(`Failed to create comparison: ${err}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const allSelected = enabledSplits.size === enabledBreakpoints.length;
  const selectedCount = enabledBreakpoints.filter(bp => enabledSplits.has(bp.name) && splitTimes[bp.name]).length;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-[--color-surface] rounded-lg w-full max-w-lg max-h-[85vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-[--color-border]">
          <h2 className="text-lg font-semibold text-[--color-text]">Add Comparison Run</h2>
          <p className="text-sm text-[--color-text-muted]">
            Enter split times to compare against during runs
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
              placeholder="e.g., Havoc WR, My Goal Time"
              className="w-full px-3 py-2 bg-[--color-surface-elevated] border border-[--color-border] rounded-lg text-[--color-text] text-sm"
              autoFocus
            />
          </div>

          {/* Split times */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm text-[--color-text-muted]">
                Split Times <span className="text-[--color-text-muted]/60">(MM:SS or HH:MM:SS)</span>
              </label>
              <button
                onClick={toggleAll}
                className="text-xs text-[--color-poe-gold] hover:text-[--color-poe-gold-light] transition-colors"
              >
                {allSelected ? 'Deselect All' : 'Select All'}
              </button>
            </div>
            <div className="space-y-1 max-h-[300px] overflow-auto rounded-lg border border-[--color-border]">
              {enabledBreakpoints.map((bp) => {
                const isSelected = enabledSplits.has(bp.name);
                return (
                  <div
                    key={bp.name}
                    className={`flex items-center gap-2 px-3 py-1.5 ${isSelected ? '' : 'opacity-40'}`}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleSplit(bp.name)}
                      className="w-3.5 h-3.5 rounded flex-shrink-0"
                    />
                    <span
                      className="text-sm text-[--color-text] flex-1 min-w-0 truncate"
                      title={bp.name}
                    >
                      {bp.name}
                    </span>
                    <input
                      type="text"
                      value={splitTimes[bp.name] || ''}
                      onChange={(e) => handleSplitTimeChange(bp.name, e.target.value)}
                      placeholder="MM:SS"
                      disabled={!isSelected}
                      className="w-20 px-2 py-0.5 bg-[--color-surface-elevated] border border-[--color-border] rounded text-[--color-text] text-sm timer-display text-center disabled:opacity-30"
                    />
                  </div>
                );
              })}
            </div>
          </div>

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
            {isSubmitting ? 'Creating...' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  );
}

function parseTimeInput(input: string): number {
  const parts = input.trim().split(':').map(Number);
  if (parts.some(isNaN)) return 0;

  if (parts.length === 2) {
    const [minutes, seconds] = parts;
    return (minutes * 60 + seconds) * 1000;
  } else if (parts.length === 3) {
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
