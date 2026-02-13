import { useState, useRef, useEffect, useCallback } from 'react';

interface SelectOption {
  value: string;
  label: string;
}

interface CustomSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  maxHeight?: number;
}

export function CustomSelect({
  value,
  onChange,
  options,
  placeholder = 'Select...',
  disabled = false,
  className = '',
  maxHeight = 280,
}: CustomSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find((o) => o.value === value);
  const displayText = selectedOption?.label || placeholder;

  // Close on click outside
  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // Scroll highlighted item into view
  useEffect(() => {
    if (!isOpen || highlightedIndex < 0 || !listRef.current) return;
    const items = listRef.current.children;
    if (items[highlightedIndex]) {
      (items[highlightedIndex] as HTMLElement).scrollIntoView({ block: 'nearest' });
    }
  }, [highlightedIndex, isOpen]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (disabled) return;

      switch (e.key) {
        case 'Enter':
        case ' ':
          e.preventDefault();
          if (isOpen && highlightedIndex >= 0) {
            onChange(options[highlightedIndex].value);
            setIsOpen(false);
          } else {
            setIsOpen(true);
            // Highlight the current value
            const idx = options.findIndex((o) => o.value === value);
            setHighlightedIndex(idx >= 0 ? idx : 0);
          }
          break;
        case 'ArrowDown':
          e.preventDefault();
          if (!isOpen) {
            setIsOpen(true);
            const idx = options.findIndex((o) => o.value === value);
            setHighlightedIndex(idx >= 0 ? idx : 0);
          } else {
            setHighlightedIndex((prev) => Math.min(prev + 1, options.length - 1));
          }
          break;
        case 'ArrowUp':
          e.preventDefault();
          if (isOpen) {
            setHighlightedIndex((prev) => Math.max(prev - 1, 0));
          }
          break;
        case 'Escape':
          setIsOpen(false);
          break;
      }
    },
    [disabled, isOpen, highlightedIndex, options, value, onChange],
  );

  const handleSelect = (optionValue: string) => {
    onChange(optionValue);
    setIsOpen(false);
  };

  return (
    <div ref={containerRef} className={`relative ${className}`} onKeyDown={handleKeyDown}>
      {/* Trigger button */}
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={`w-full flex items-center justify-between gap-2 text-left
          bg-[--color-surface-elevated] border border-[--color-border] rounded-lg
          text-sm text-[--color-text] transition-colors
          hover:border-[--color-poe-gold]/40 focus:outline-none focus:border-[--color-poe-gold]/60
          disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:border-[--color-border]
          ${isOpen ? 'border-[--color-poe-gold]/60' : ''}
          ${className.includes('p-3') ? 'p-3' : 'px-2 py-1.5'}`}
      >
        <span className={`truncate ${!selectedOption ? 'text-[--color-text-muted]' : ''}`}>
          {displayText}
        </span>
        <svg
          className={`w-4 h-4 flex-shrink-0 text-[--color-text-muted] transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div
          className="absolute z-50 w-full mt-1 border border-[--color-border] rounded-lg shadow-xl overflow-hidden"
          style={{ maxHeight, backgroundColor: '#1e1e22' }}
        >
          <div ref={listRef} className="overflow-auto" style={{ maxHeight: maxHeight - 2 }}>
            {options.map((option, index) => {
              const isSelected = option.value === value;
              const isHighlighted = index === highlightedIndex;

              return (
                <div
                  key={option.value}
                  onClick={() => handleSelect(option.value)}
                  onMouseEnter={() => setHighlightedIndex(index)}
                  className={`px-3 py-2 text-sm cursor-pointer truncate transition-colors
                    ${isSelected
                      ? 'text-[--color-poe-gold]'
                      : isHighlighted
                        ? 'text-[--color-text]'
                        : 'text-[--color-text-muted]'
                    }`}
                  style={{
                    backgroundColor: isSelected
                      ? '#2a2520'
                      : isHighlighted
                        ? '#2a2a2e'
                        : undefined,
                  }}
                >
                  {option.label}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
