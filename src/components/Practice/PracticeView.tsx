import { useEffect } from 'react';
import { usePracticeStore } from '../../stores/practiceStore';
import { HelpTip } from '../Shared/HelpTip';
import { ZoneSelector } from './ZoneSelector';
import { PracticeTimer } from './PracticeTimer';
import { PracticeHistory } from './PracticeHistory';

export function PracticeView() {
  const { selectedZones, isActive, loadFromStorage } = usePracticeStore();

  useEffect(() => {
    loadFromStorage();
  }, [loadFromStorage]);

  return (
    <div className="h-full flex flex-col p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[--color-text] flex items-center gap-2" style={{ textShadow: '0 0 30px rgba(175, 96, 37, 0.2)' }}>
          Practice Mode
          <HelpTip>
            Practice zone layouts on a high-level, fast character. Run the same zones repeatedly to learn tileset layouts and optimize pathing. Your times are saved so you can track improvement across many attempts.
          </HelpTip>
        </h1>
        <p className="text-[--color-text-muted] mt-1 text-sm">
          Practice individual zones or run through a sequence of zones.
        </p>
      </div>

      <div className="flex-1 flex gap-6 min-h-0">
        {/* Left side - Zone selector and controls */}
        <div className="flex-1 flex flex-col min-h-0">
          {!isActive ? (
            <ZoneSelector />
          ) : (
            <PracticeTimer />
          )}
        </div>

        {/* Right side - Attempt history */}
        {selectedZones.length > 0 && (
          <div className="w-80 flex-shrink-0">
            <PracticeHistory />
          </div>
        )}
      </div>
    </div>
  );
}
