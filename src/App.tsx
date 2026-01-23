import { useEffect } from "react";
import { useSettingsStore } from "./stores/settingsStore";
import { useTauriEvents } from "./hooks/useTauriEvents";
import { Sidebar } from "./components/Sidebar";
import { TimerView } from "./components/Timer/TimerView";
import { SnapshotView } from "./components/Snapshot/SnapshotView";
import { ComparisonView } from "./components/Comparison/ComparisonView";
import { SettingsView } from "./components/Settings/SettingsView";

function App() {
  const currentView = useSettingsStore((state) => state.currentView);

  // Initialize Tauri event listeners
  useTauriEvents();

  // Load settings on mount
  useEffect(() => {
    // Settings will be loaded from Tauri backend
    // For now, try to detect POE log path
    detectLogPath();
  }, []);

  const detectLogPath = async () => {
    // This will be implemented via Tauri command
    // Default paths to check:
    // Steam: C:\Program Files (x86)\Steam\steamapps\common\Path of Exile\logs\Client.txt
    // Standalone: C:\Program Files (x86)\Grinding Gear Games\Path of Exile\logs\Client.txt
    // Epic: C:\Program Files\Epic Games\PathOfExile\logs\Client.txt
  };

  const renderView = () => {
    switch (currentView) {
      case 'timer':
        return <TimerView />;
      case 'snapshots':
        return <SnapshotView />;
      case 'comparison':
        return <ComparisonView />;
      case 'settings':
        return <SettingsView />;
      default:
        return <TimerView />;
    }
  };

  return (
    <div className="flex h-screen bg-[--color-poe-darker]">
      <Sidebar />
      <main className="flex-1 overflow-auto">
        {renderView()}
      </main>
    </div>
  );
}

export default App;
