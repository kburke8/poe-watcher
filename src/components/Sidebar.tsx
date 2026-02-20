import { useState, useEffect, useCallback } from 'react';
import { getVersion } from '@tauri-apps/api/app';
import { invoke } from '@tauri-apps/api/core';
import { Timer, Camera, GitCompareArrows, History, Settings as SettingsIcon, Monitor } from 'lucide-react';
import { useSettingsStore } from '../stores/settingsStore';
import { useUpdateChecker } from '../hooks/useUpdateChecker';
import { Button } from './Shared/Button';
import type { ViewMode } from '../types';
import type { LucideIcon } from 'lucide-react';

interface NavItem {
  id: ViewMode;
  label: string;
  icon: LucideIcon;
}

const navItems: NavItem[] = [
  { id: 'timer', label: 'Timer', icon: Timer },
  { id: 'snapshots', label: 'Snapshots', icon: Camera },
  { id: 'comparison', label: 'Compare', icon: GitCompareArrows },
  { id: 'history', label: 'History', icon: History },
  { id: 'settings', label: 'Settings', icon: SettingsIcon },
];

export function Sidebar() {
  const { currentView, setCurrentView, checkUpdates, overlayEnabled, overlayOpen, setOverlayOpen, hotkeys } = useSettingsStore();
  const [appVersion, setAppVersion] = useState('');
  const { available, version, downloading, progress, downloadAndInstall } = useUpdateChecker(checkUpdates);
  const [showPopup, setShowPopup] = useState(false);

  const handleToggleOverlay = useCallback(async () => {
    try {
      const isOpen = await invoke<boolean>('toggle_overlay');
      setOverlayOpen(isOpen);
    } catch (error) {
      console.error('Failed to toggle overlay:', error);
    }
  }, [setOverlayOpen]);

  useEffect(() => {
    getVersion().then(setAppVersion).catch(() => setAppVersion('0.0.0'));
  }, []);

  return (
    <aside className="w-16 sidebar-gradient flex flex-col items-center py-4">
      <nav className="flex flex-col gap-2">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => setCurrentView(item.id)}
            className={`
              w-11 h-11 flex items-center justify-center rounded-lg
              transition-all duration-150 active:scale-90
              ${currentView === item.id
                ? 'sidebar-active text-[--color-poe-darker] font-bold'
                : 'text-[--color-text-muted] hover:text-[--color-poe-gold-light] hover:bg-[--color-poe-gold]/10 hover:shadow-[0_0_12px_rgba(175,96,37,0.2)] active:bg-[--color-border]'
              }
            `}
            title={item.label}
          >
            <item.icon className="w-5 h-5" strokeWidth={currentView === item.id ? 2.25 : 1.75} />
          </button>
        ))}
      </nav>

      {/* Overlay toggle button */}
      {overlayEnabled && (
        <button
          onClick={handleToggleOverlay}
          className={`
            w-11 h-11 flex items-center justify-center rounded-lg mt-4
            transition-all duration-150 active:scale-90 border
            ${overlayOpen
              ? 'text-[--color-poe-gold] border-[--color-poe-gold]/60 bg-[--color-poe-gold]/10'
              : 'text-[--color-text-muted] border-transparent hover:text-[--color-poe-gold-light] hover:bg-[--color-poe-gold]/10 hover:border-[--color-poe-gold]/30 hover:shadow-[0_0_12px_rgba(175,96,37,0.2)]'
            }
          `}
          title={overlayOpen ? `Close Overlay (${hotkeys.toggleOverlay})` : `Open Overlay (${hotkeys.toggleOverlay})`}
        >
          <Monitor className="w-5 h-5" strokeWidth={1.75} />
        </button>
      )}

      <div className="mt-auto relative">
        {available ? (
          <button
            onClick={() => setShowPopup(!showPopup)}
            className="text-xs text-[--color-poe-gold] font-semibold animate-pulse"
            title={`Update ${version} available`}
          >
            v{appVersion}
          </button>
        ) : (
          <span className="text-xs text-[--color-text-muted]">v{appVersion}</span>
        )}

        {showPopup && available && (
          <div className="absolute bottom-8 left-0 w-48 bg-[--color-surface-elevated] border border-[--color-border] rounded-lg p-3 shadow-lg z-50">
            <p className="text-sm text-[--color-text] mb-2">
              v{version} available
            </p>
            {downloading ? (
              <div className="w-full bg-[--color-surface] rounded-full h-2">
                <div
                  className="bg-[--color-poe-gold] h-2 rounded-full transition-all"
                  style={{ width: `${progress}%` }}
                />
              </div>
            ) : (
              <Button variant="primary" size="sm" className="w-full" onClick={downloadAndInstall}>
                Update & Restart
              </Button>
            )}
          </div>
        )}
      </div>
    </aside>
  );
}
