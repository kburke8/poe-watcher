import { useRef } from 'react';
import { Swords, Building2 } from 'lucide-react';
import type { Breakpoint } from '../../types';

export interface SplitTimeEditorProps {
  breakpoints: Breakpoint[];
  splitTimes: Record<string, string>;
  setSplitTimes: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  bossTimes: Record<string, string>;
  setBossTimes: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  townTimes: Record<string, string>;
  setTownTimes: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  /** If provided, checkboxes are shown and only checked splits are editable */
  enabledSplits?: Set<string>;
  onToggleSplit?: (name: string) => void;
  onToggleAll?: () => void;
  allSelected?: boolean;
}

export function SplitTimeEditor({
  breakpoints,
  splitTimes,
  setSplitTimes,
  bossTimes,
  setBossTimes,
  townTimes,
  setTownTimes,
  enabledSplits,
  onToggleSplit,
  onToggleAll,
  allSelected,
}: SplitTimeEditorProps) {
  const timeInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const showCheckboxes = !!enabledSplits;

  const isEnabled = (name: string) => !showCheckboxes || enabledSplits!.has(name);

  const getActiveBreakpoints = () =>
    showCheckboxes ? breakpoints.filter(bp => enabledSplits!.has(bp.name)) : breakpoints;

  const focusNextTimeInput = (currentBpName: string) => {
    const activeList = getActiveBreakpoints();
    const currentIndex = activeList.findIndex(bp => bp.name === currentBpName);
    if (currentIndex >= 0 && currentIndex < activeList.length - 1) {
      const nextBpName = activeList[currentIndex + 1].name;
      timeInputRefs.current[nextBpName]?.focus();
    }
  };

  const makeKeyHandler = (
    times: Record<string, string>,
    setTimes: React.Dispatch<React.SetStateAction<Record<string, string>>>,
    maxLen: number,
  ) => (e: React.KeyboardEvent<HTMLInputElement>, bpName: string) => {
    if (e.key >= '0' && e.key <= '9') {
      e.preventDefault();
      const current = times[bpName] || '';
      if (current.length < maxLen) {
        setTimes(prev => ({ ...prev, [bpName]: current + e.key }));
      }
    } else if (e.key === 'Backspace') {
      e.preventDefault();
      const current = times[bpName] || '';
      if (current.length > 0) {
        setTimes(prev => ({ ...prev, [bpName]: current.slice(0, -1) }));
      }
    } else if (e.key === 'Delete') {
      e.preventDefault();
      setTimes(prev => ({ ...prev, [bpName]: '' }));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      focusNextTimeInput(bpName);
    } else if (!['Tab', 'Shift', 'Control', 'Alt', 'Meta', 'Escape'].includes(e.key)) {
      e.preventDefault();
    }
  };

  const handleTimeKeyDown = makeKeyHandler(splitTimes, setSplitTimes, 6);
  const handleBossKeyDown = makeKeyHandler(bossTimes, setBossTimes, 4);
  const handleTownKeyDown = makeKeyHandler(townTimes, setTownTimes, 4);

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <label className="text-sm text-[--color-text-muted]">Split Times</label>
        {showCheckboxes && onToggleAll && (
          <button
            onClick={onToggleAll}
            className="text-xs text-[--color-poe-gold] hover:text-[--color-poe-gold-light] transition-colors"
          >
            {allSelected ? 'Deselect All' : 'Select All'}
          </button>
        )}
      </div>
      <div className="space-y-1 max-h-[300px] overflow-auto rounded-lg border border-[--color-border]">
        {breakpoints.map((bp) => {
          const enabled = isEnabled(bp.name);
          return (
            <div
              key={bp.name}
              className={`flex items-center gap-2 px-3 py-1.5 ${enabled ? '' : 'opacity-40'}`}
            >
              {showCheckboxes && (
                <input
                  type="checkbox"
                  checked={enabled}
                  onChange={() => onToggleSplit?.(bp.name)}
                  className="w-3.5 h-3.5 rounded flex-shrink-0"
                />
              )}
              <span
                className="text-sm text-[--color-text] flex-1 min-w-0 truncate"
                title={bp.name}
              >
                {bp.name}
              </span>
              {/* Split time */}
              <input
                ref={(el) => { timeInputRefs.current[bp.name] = el; }}
                type="text"
                value={formatDigitsDisplay(splitTimes[bp.name] || '')}
                onChange={() => {}}
                onKeyDown={(e) => handleTimeKeyDown(e, bp.name)}
                disabled={!enabled}
                className={`w-[5.5rem] px-2 py-0.5 bg-[--color-surface-elevated] border border-[--color-border] rounded text-sm timer-display text-center disabled:opacity-30 ${splitTimes[bp.name] ? 'text-[--color-text]' : 'text-[--color-text-muted]/40'}`}
              />
              {/* Boss fight time */}
              <div className="flex items-center gap-0.5">
                <Swords className="w-3 h-3 text-[--color-text-muted]/50 flex-shrink-0" />
                <input
                  type="text"
                  value={formatShortDigitsDisplay(bossTimes[bp.name] || '')}
                  onChange={() => {}}
                  onKeyDown={(e) => handleBossKeyDown(e, bp.name)}
                  disabled={!enabled}
                  className={`w-[3.5rem] px-1 py-0.5 bg-[--color-surface-elevated] border border-[--color-border] rounded text-xs timer-display text-center disabled:opacity-30 ${bossTimes[bp.name] ? 'text-[--color-text]' : 'text-[--color-text-muted]/40'}`}
                />
              </div>
              {/* Town time */}
              <div className="flex items-center gap-0.5">
                <Building2 className="w-3 h-3 text-[--color-text-muted]/50 flex-shrink-0" />
                <input
                  type="text"
                  value={formatShortDigitsDisplay(townTimes[bp.name] || '')}
                  onChange={() => {}}
                  onKeyDown={(e) => handleTownKeyDown(e, bp.name)}
                  disabled={!enabled}
                  className={`w-[3.5rem] px-1 py-0.5 bg-[--color-surface-elevated] border border-[--color-border] rounded text-xs timer-display text-center disabled:opacity-30 ${townTimes[bp.name] ? 'text-[--color-text]' : 'text-[--color-text-muted]/40'}`}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Format / parse helpers (exported for use by parent modals) ──

export function msToDigits(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const raw = `${hours.toString().padStart(2, '0')}${minutes.toString().padStart(2, '0')}${seconds.toString().padStart(2, '0')}`;
  return raw.replace(/^0+/, '') || '0';
}

export function msToShortDigits(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const raw = `${minutes.toString().padStart(2, '0')}${seconds.toString().padStart(2, '0')}`;
  return raw.replace(/^0+/, '') || '0';
}

export function parseDigitsToMs(digits: string): number {
  if (!digits) return 0;
  const padded = digits.padStart(6, '0');
  const hours = parseInt(padded.slice(0, 2));
  const minutes = parseInt(padded.slice(2, 4));
  const seconds = parseInt(padded.slice(4, 6));
  return (hours * 3600 + minutes * 60 + seconds) * 1000;
}

export function parseShortDigitsToMs(digits: string): number {
  if (!digits) return 0;
  const padded = digits.padStart(4, '0');
  const minutes = parseInt(padded.slice(0, 2));
  const seconds = parseInt(padded.slice(2, 4));
  return (minutes * 60 + seconds) * 1000;
}

function formatDigitsDisplay(digits: string): string {
  const padded = (digits || '').padStart(6, '0');
  const h = parseInt(padded.slice(0, 2));
  const m = padded.slice(2, 4);
  const s = padded.slice(4, 6);
  return `${h}:${m}:${s}`;
}

function formatShortDigitsDisplay(digits: string): string {
  const padded = (digits || '').padStart(4, '0');
  const m = parseInt(padded.slice(0, 2));
  const s = padded.slice(2, 4);
  return `${m}:${s}`;
}

export function formatTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}
