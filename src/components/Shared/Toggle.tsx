interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  size?: 'sm' | 'md';
  disabled?: boolean;
}

export function Toggle({ checked, onChange, size = 'md', disabled = false }: ToggleProps) {
  const trackSize = size === 'sm' ? 'w-10 h-5' : 'w-12 h-6';
  const thumbSize = size === 'sm' ? 'w-4 h-4' : 'w-5 h-5';
  const translate = size === 'sm'
    ? (checked ? 'translate-x-5' : 'translate-x-0.5')
    : (checked ? 'translate-x-6' : 'translate-x-0.5');

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => !disabled && onChange(!checked)}
      disabled={disabled}
      className={`${trackSize} rounded-full transition-all duration-150 active:scale-95 border
        disabled:opacity-50 disabled:cursor-not-allowed
        ${checked
          ? 'bg-[--color-poe-gold] border-[--color-poe-gold-light]'
          : 'bg-[--color-surface-elevated] border-[--color-border]'
        }
      `}
    >
      <div
        className={`${thumbSize} rounded-full bg-white shadow transition-transform duration-150 ${translate}`}
      />
    </button>
  );
}
