import { useSettingsStore } from '../stores/settingsStore';
import type { ViewMode } from '../types';

interface NavItem {
  id: ViewMode;
  label: string;
  icon: string;
}

const navItems: NavItem[] = [
  { id: 'timer', label: 'Timer', icon: '⏱' },
  { id: 'snapshots', label: 'Snapshots', icon: '📸' },
  { id: 'comparison', label: 'Compare', icon: '📊' },
  { id: 'settings', label: 'Settings', icon: '⚙' },
];

export function Sidebar() {
  const { currentView, setCurrentView } = useSettingsStore();

  return (
    <aside className="w-16 bg-[--color-surface] border-r border-[--color-border] flex flex-col items-center py-4">
      <div className="mb-8">
        <span className="text-2xl text-[--color-poe-gold]">⚔</span>
      </div>

      <nav className="flex flex-col gap-2">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => setCurrentView(item.id)}
            className={`
              w-12 h-12 flex items-center justify-center rounded-lg
              transition-colors duration-150
              ${currentView === item.id
                ? 'bg-[--color-poe-gold] text-[--color-poe-darker]'
                : 'text-[--color-text-muted] hover:bg-[--color-surface-elevated] hover:text-[--color-text]'
              }
            `}
            title={item.label}
          >
            <span className="text-xl">{item.icon}</span>
          </button>
        ))}
      </nav>

      <div className="mt-auto">
        <span className="text-xs text-[--color-text-muted]">v0.1</span>
      </div>
    </aside>
  );
}
