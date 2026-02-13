import { useState, useCallback, useRef, useEffect } from 'react';

interface HotkeyInputProps {
  value: string;
  onChange: (shortcut: string) => void;
  error?: string;
}

/** Maps browser KeyboardEvent.key values to Tauri shortcut key names */
function mapKeyToTauri(key: string): string | null {
  // Ignore standalone modifier keys
  if (['Control', 'Shift', 'Alt', 'Meta'].includes(key)) return null;

  const keyMap: Record<string, string> = {
    ' ': 'Space',
    'ArrowUp': 'Up',
    'ArrowDown': 'Down',
    'ArrowLeft': 'Left',
    'ArrowRight': 'Right',
    'Enter': 'Enter',
    'Escape': 'Escape',
    'Tab': 'Tab',
    'Backspace': 'Backspace',
    'Delete': 'Delete',
    'Home': 'Home',
    'End': 'End',
    'PageUp': 'PageUp',
    'PageDown': 'PageDown',
    'Insert': 'Insert',
  };

  if (keyMap[key]) return keyMap[key];

  // Function keys
  if (/^F\d{1,2}$/.test(key)) return key;

  // Single character keys - uppercase
  if (key.length === 1) return key.toUpperCase();

  return key;
}

export function HotkeyInput({ value, onChange, error }: HotkeyInputProps) {
  const [capturing, setCapturing] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    e.preventDefault();
    e.stopPropagation();

    // Escape cancels capture
    if (e.key === 'Escape') {
      setCapturing(false);
      return;
    }

    const tauriKey = mapKeyToTauri(e.key);
    if (!tauriKey) return; // Ignore lone modifier presses

    // Require at least one modifier
    if (!e.ctrlKey && !e.shiftKey && !e.altKey) return;

    // Build shortcut string in Tauri format
    const parts: string[] = [];
    if (e.ctrlKey) parts.push('Ctrl');
    if (e.shiftKey) parts.push('Shift');
    if (e.altKey) parts.push('Alt');
    parts.push(tauriKey);

    const shortcut = parts.join('+');
    onChange(shortcut);
    setCapturing(false);
  }, [onChange]);

  useEffect(() => {
    if (capturing) {
      window.addEventListener('keydown', handleKeyDown, true);
      return () => window.removeEventListener('keydown', handleKeyDown, true);
    }
  }, [capturing, handleKeyDown]);

  const handleBlur = useCallback(() => {
    // Delay to avoid immediate blur when clicking the button
    setTimeout(() => setCapturing(false), 200);
  }, []);

  return (
    <div className="flex flex-col gap-1">
      <button
        ref={buttonRef}
        onClick={() => setCapturing(true)}
        onBlur={handleBlur}
        className={`px-3 py-1.5 text-sm font-mono rounded-md border-2 transition-all min-w-[160px] text-left ${
          capturing
            ? 'border-[--color-poe-gold] bg-[--color-poe-gold]/10 text-[--color-poe-gold] animate-pulse'
            : error
            ? 'border-red-500 bg-red-500/10 text-[--color-text]'
            : 'border-[--color-border] bg-[--color-surface-elevated] text-[--color-text] hover:border-[--color-poe-gold]/50'
        }`}
      >
        {capturing ? 'Press keys...' : value}
      </button>
      {error && (
        <span className="text-xs text-red-400">{error}</span>
      )}
    </div>
  );
}
