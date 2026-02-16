import type { ButtonHTMLAttributes, ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'destructive';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: LucideIcon;
  loading?: boolean;
  children: ReactNode;
}

const variantStyles: Record<ButtonVariant, { className: string; style?: React.CSSProperties }> = {
  primary: {
    className: 'text-[--color-poe-darker] font-semibold',
    style: {
      background: 'linear-gradient(180deg, #c47030 0%, #8f4e1a 100%)',
      borderColor: 'var(--color-poe-gold-light)',
      boxShadow: '0 0 10px rgba(175, 96, 37, 0.3), inset 0 1px 0 rgba(255,255,255,0.15)',
    },
  },
  secondary: {
    className: 'text-[--color-text] font-medium',
    style: {
      background: 'linear-gradient(180deg, #2a2520 0%, #1c1916 100%)',
      borderColor: 'rgba(175, 96, 37, 0.35)',
      boxShadow: 'inset 0 1px 0 rgba(232,224,214,0.04), 0 2px 4px rgba(0,0,0,0.3)',
    },
  },
  ghost: {
    className: 'bg-transparent text-[--color-text-muted] border-transparent hover:text-[--color-text] hover:bg-[--color-surface-elevated] font-medium',
  },
  destructive: {
    className: 'text-white font-semibold',
    style: {
      background: 'linear-gradient(180deg, #dc3545 0%, #a02030 100%)',
      borderColor: '#ef5555',
      boxShadow: '0 0 8px rgba(220, 50, 50, 0.25), inset 0 1px 0 rgba(255,255,255,0.1)',
    },
  },
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-4 py-2 text-sm',
  lg: 'px-6 py-3 text-base',
};

export function Button({
  variant = 'secondary',
  size = 'md',
  icon: Icon,
  loading = false,
  children,
  disabled,
  className = '',
  style,
  ...props
}: ButtonProps) {
  const vs = variantStyles[variant];
  return (
    <button
      disabled={disabled || loading}
      className={`
        inline-flex items-center justify-center gap-2 rounded-lg border
        transition-all duration-100 active:scale-95 active:brightness-90
        focus-visible:ring-2 focus-visible:ring-[--color-poe-gold] focus-visible:ring-offset-1 focus-visible:ring-offset-[--color-poe-darker]
        disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100
        hover:brightness-110
        ${vs.className}
        ${sizeClasses[size]}
        ${className}
      `}
      style={{ ...vs.style, ...style }}
      {...props}
    >
      {loading ? (
        <svg className="w-4 h-4 spinner" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
          <circle cx="12" cy="12" r="10" strokeOpacity={0.25} />
          <path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round" />
        </svg>
      ) : Icon ? (
        <Icon className="w-4 h-4" strokeWidth={1.75} />
      ) : null}
      {children}
    </button>
  );
}
