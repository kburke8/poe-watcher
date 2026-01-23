import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';
import { useSettingsStore } from '../../stores/settingsStore';

export function SettingsView() {
  const {
    poeLogPath,
    accountName,
    overlayEnabled,
    overlayOpacity,
    soundEnabled,
    breakpoints,
    setLogPath,
    setAccountName,
    setOverlayEnabled,
    setOverlayOpacity,
    setSoundEnabled,
    toggleBreakpoint,
  } = useSettingsStore();

  const handleBrowseLogPath = async () => {
    try {
      const result = await open({
        multiple: false,
        filters: [{
          name: 'Log Files',
          extensions: ['txt']
        }],
        title: 'Select Client.txt',
      });
      if (result) {
        setLogPath(result);
      }
    } catch (error) {
      console.error('Failed to browse for log path:', error);
    }
  };

  const handleDetectLogPath = async () => {
    try {
      const result = await invoke<string | null>('detect_log_path_cmd');
      if (result) {
        setLogPath(result);
      } else {
        alert('Could not auto-detect POE log path. Please browse manually.');
      }
    } catch (error) {
      console.error('Failed to detect log path:', error);
    }
  };

  const handleSaveSettings = async () => {
    try {
      await invoke('save_settings', {
        settings: {
          poe_log_path: poeLogPath,
          account_name: accountName,
          overlay_enabled: overlayEnabled,
          overlay_opacity: overlayOpacity,
          sound_enabled: soundEnabled,
        },
      });
    } catch (error) {
      console.error('Failed to save settings:', error);
    }
  };

  return (
    <div className="h-full overflow-auto p-6">
      <div className="max-w-2xl">
        <h1 className="text-2xl font-bold text-[--color-text] mb-6">Settings</h1>

        {/* POE Configuration */}
        <section className="mb-8">
          <h2 className="text-lg font-semibold text-[--color-text] mb-4">Path of Exile</h2>
          <div className="bg-[--color-surface] rounded-lg p-4 space-y-4">
            {/* Log path */}
            <div>
              <label className="block text-sm text-[--color-text-muted] mb-2">
                Client.txt Log Path
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={poeLogPath}
                  onChange={(e) => setLogPath(e.target.value)}
                  placeholder="C:\...\Path of Exile\logs\Client.txt"
                  className="flex-1 p-3 bg-[--color-surface-elevated] border border-[--color-border] rounded-lg text-[--color-text] placeholder-[--color-text-muted]"
                />
                <button
                  onClick={handleBrowseLogPath}
                  className="px-4 py-2 bg-[--color-surface-elevated] text-[--color-text] rounded-lg hover:bg-[--color-border] transition-colors"
                >
                  Browse
                </button>
                <button
                  onClick={handleDetectLogPath}
                  className="px-4 py-2 bg-[--color-poe-gold] text-[--color-poe-darker] rounded-lg hover:bg-[--color-poe-gold-light] transition-colors"
                >
                  Auto-detect
                </button>
              </div>
              <p className="text-xs text-[--color-text-muted] mt-2">
                The application monitors this file for game events.
              </p>
            </div>

            {/* Account name */}
            <div>
              <label className="block text-sm text-[--color-text-muted] mb-2">
                POE Account Name
              </label>
              <input
                type="text"
                value={accountName}
                onChange={(e) => setAccountName(e.target.value)}
                placeholder="YourAccountName"
                className="w-full p-3 bg-[--color-surface-elevated] border border-[--color-border] rounded-lg text-[--color-text] placeholder-[--color-text-muted]"
              />
              <p className="text-xs text-[--color-text-muted] mt-2">
                Required for fetching character data from the POE API. Your profile must be set to public.
              </p>
            </div>
          </div>
        </section>

        {/* Overlay Settings */}
        <section className="mb-8">
          <h2 className="text-lg font-semibold text-[--color-text] mb-4">Overlay</h2>
          <div className="bg-[--color-surface] rounded-lg p-4 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[--color-text]">Enable Overlay</div>
                <div className="text-xs text-[--color-text-muted]">Show minimal timer as overlay window</div>
              </div>
              <button
                onClick={() => setOverlayEnabled(!overlayEnabled)}
                className={`w-12 h-6 rounded-full transition-colors ${
                  overlayEnabled ? 'bg-[--color-poe-gold]' : 'bg-[--color-surface-elevated]'
                }`}
              >
                <div
                  className={`w-5 h-5 rounded-full bg-white transition-transform ${
                    overlayEnabled ? 'translate-x-6' : 'translate-x-0.5'
                  }`}
                />
              </button>
            </div>

            <div>
              <label className="block text-sm text-[--color-text-muted] mb-2">
                Overlay Opacity: {Math.round(overlayOpacity * 100)}%
              </label>
              <input
                type="range"
                min="0.2"
                max="1"
                step="0.05"
                value={overlayOpacity}
                onChange={(e) => setOverlayOpacity(parseFloat(e.target.value))}
                className="w-full"
              />
            </div>
          </div>
        </section>

        {/* Sound Settings */}
        <section className="mb-8">
          <h2 className="text-lg font-semibold text-[--color-text] mb-4">Audio</h2>
          <div className="bg-[--color-surface] rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[--color-text]">Enable Sounds</div>
                <div className="text-xs text-[--color-text-muted]">Play sounds on splits and events</div>
              </div>
              <button
                onClick={() => setSoundEnabled(!soundEnabled)}
                className={`w-12 h-6 rounded-full transition-colors ${
                  soundEnabled ? 'bg-[--color-poe-gold]' : 'bg-[--color-surface-elevated]'
                }`}
              >
                <div
                  className={`w-5 h-5 rounded-full bg-white transition-transform ${
                    soundEnabled ? 'translate-x-6' : 'translate-x-0.5'
                  }`}
                />
              </button>
            </div>
          </div>
        </section>

        {/* Breakpoints */}
        <section className="mb-8">
          <h2 className="text-lg font-semibold text-[--color-text] mb-4">Breakpoints</h2>
          <div className="bg-[--color-surface] rounded-lg overflow-hidden">
            <div className="p-4 border-b border-[--color-border]">
              <p className="text-sm text-[--color-text-muted]">
                Toggle which breakpoints trigger automatic splits.
              </p>
            </div>
            <div className="max-h-80 overflow-auto">
              {breakpoints.map((bp) => (
                <div
                  key={bp.name}
                  className="flex items-center justify-between p-3 border-b border-[--color-border] last:border-0"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-sm">{getTypeIcon(bp.type)}</span>
                    <span className="text-[--color-text]">{bp.name}</span>
                    <span className="text-xs text-[--color-text-muted] bg-[--color-surface-elevated] px-2 py-0.5 rounded">
                      {bp.type}
                    </span>
                  </div>
                  <button
                    onClick={() => toggleBreakpoint(bp.name)}
                    className={`w-10 h-5 rounded-full transition-colors ${
                      bp.isEnabled ? 'bg-[--color-timer-ahead]' : 'bg-[--color-surface-elevated]'
                    }`}
                  >
                    <div
                      className={`w-4 h-4 rounded-full bg-white transition-transform ${
                        bp.isEnabled ? 'translate-x-5' : 'translate-x-0.5'
                      }`}
                    />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Save button */}
        <div className="flex gap-3">
          <button
            onClick={handleSaveSettings}
            className="px-6 py-3 bg-[--color-poe-gold] text-[--color-poe-darker] font-semibold rounded-lg hover:bg-[--color-poe-gold-light] transition-colors"
          >
            Save Settings
          </button>
        </div>
      </div>
    </div>
  );
}

function getTypeIcon(type: string): string {
  switch (type) {
    case 'zone': return '📍';
    case 'level': return '⬆';
    case 'boss': return '💀';
    case 'act': return '🏛';
    case 'lab': return '🏆';
    case 'custom': return '⭐';
    default: return '•';
  }
}
