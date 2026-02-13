import { useState, useEffect, useCallback } from 'react';
import { getVersion } from '@tauri-apps/api/app';
import { invoke } from '@tauri-apps/api/core';
import { useSettingsStore } from '../stores/settingsStore';
import { useUpdateChecker } from '../hooks/useUpdateChecker';
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
  { id: 'history', label: 'History', icon: '📋' },
  { id: 'settings', label: 'Settings', icon: '⚙' },
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
              transition-all duration-100 active:scale-90 border
              ${currentView === item.id
                ? 'bg-[--color-poe-gold] text-[--color-poe-darker] border-[--color-poe-gold-light] shadow-md active:shadow-sm'
                : 'text-[--color-text-muted] border-transparent hover:bg-[--color-surface-elevated] hover:text-[--color-text] hover:border-[--color-border] hover:shadow-sm active:bg-[--color-border]'
              }
            `}
            title={item.label}
          >
            <span className="text-xl">{item.icon}</span>
          </button>
        ))}
      </nav>

      {/* Overlay toggle button */}
      {overlayEnabled && (
        <button
          onClick={handleToggleOverlay}
          className={`
            w-12 h-12 flex items-center justify-center rounded-lg mt-4
            transition-all duration-100 active:scale-90 border
            ${overlayOpen
              ? 'text-[--color-poe-gold] border-[--color-poe-gold]/60 bg-[--color-poe-gold]/10'
              : 'text-[--color-text-muted] border-transparent hover:bg-[--color-surface-elevated] hover:text-[--color-text] hover:border-[--color-border] hover:shadow-sm'
            }
          `}
          title={overlayOpen ? `Close Overlay (${hotkeys.toggleOverlay})` : `Open Overlay (${hotkeys.toggleOverlay})`}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
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
              <button
                onClick={downloadAndInstall}
                className="w-full px-3 py-1.5 text-sm bg-[--color-poe-gold] text-[--color-poe-darker] rounded-md font-semibold hover:bg-[--color-poe-gold-light] active:scale-95 transition-all"
              >
                Update & Restart
              </button>
            )}
          </div>
        )}
        <span className="text-[9px] text-[--color-text-muted] opacity-50 mt-1 text-center leading-tight" title="Not affiliated with or endorsed by Grinding Gear Games">
          Not affiliated with GGG
        </span>
      </div>
    </aside>
  );
}
