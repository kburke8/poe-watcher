import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
}

export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
      <Icon className="w-12 h-12 text-[--color-text-muted] mb-4" strokeWidth={1.25} />
      <h3 className="text-lg font-medium text-[--color-text] mb-1">{title}</h3>
      {description && (
        <p className="text-sm text-[--color-text-muted] max-w-xs">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
