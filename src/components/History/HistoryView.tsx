import { useState, useEffect } from 'react';
import { Plus } from 'lucide-react';
import { useRunStore } from '../../stores/runStore';
import { HelpTip } from '../Shared/HelpTip';
import { RunFilter } from '../Shared/RunFilter';
import { Button } from '../Shared/Button';
import { RunsTab } from './RunsTab';
import { AnalyticsTab } from './AnalyticsTab';
import { AddReferenceRunModal } from './AddReferenceRunModal';
import type { RunFilters } from '../../types';

type TabType = 'runs' | 'analytics';

export function HistoryView() {
  const [activeTab, setActiveTab] = useState<TabType>('runs');
  const [showAddReferenceModal, setShowAddReferenceModal] = useState(false);
  const { filters, setFilters, clearFilters, loadFilteredRuns, loadRunStats, loadSplitStats } =
    useRunStore();

  // Load data when filters change
  useEffect(() => {
    loadFilteredRuns();
    loadRunStats();
    loadSplitStats();
  }, [filters, loadFilteredRuns, loadRunStats, loadSplitStats]);

  const handleFiltersChange = (newFilters: Partial<RunFilters>) => {
    setFilters(newFilters);
  };

  const handleClearFilters = () => {
    clearFilters();
  };

  return (
    <div className="h-full flex flex-col p-6">
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-[--color-text] flex items-center gap-2">
          Run History
          <HelpTip>
            Browse all completed and abandoned runs with detailed split times, statistics, and trends over time. Click a run to view its splits and snapshots.
          </HelpTip>
        </h1>
        <p className="text-[--color-text-muted] mt-1">
          View past runs and analyze your performance
        </p>
      </div>

      {/* Filters */}
      <div className="mb-4">
        <RunFilter
          filters={filters}
          onFiltersChange={handleFiltersChange}
          onClear={handleClearFilters}
          showPresetFilter={true}
          showReferenceToggle={true}
        />
      </div>

      {/* Tabs and Actions */}
      <div className="flex justify-between items-center mb-4">
        <div className="flex gap-6 border-b border-[--color-border]">
          <button
            onClick={() => setActiveTab('runs')}
            className={`pb-2 px-1 text-sm border-b-2 transition-colors ${
              activeTab === 'runs'
                ? 'text-[--color-text] border-[--color-poe-gold] font-medium'
                : 'text-[--color-text-muted] border-transparent hover:text-[--color-text] hover:border-[--color-poe-gold]/50'
            }`}
          >
            Runs
          </button>
          <button
            onClick={() => setActiveTab('analytics')}
            className={`pb-2 px-1 text-sm border-b-2 transition-colors ${
              activeTab === 'analytics'
                ? 'text-[--color-text] border-[--color-poe-gold] font-medium'
                : 'text-[--color-text-muted] border-transparent hover:text-[--color-text] hover:border-[--color-poe-gold]/50'
            }`}
          >
            Analytics
          </button>
        </div>
        <Button
          variant="secondary"
          icon={Plus}
          onClick={() => setShowAddReferenceModal(true)}
        >
          Add Reference Run
        </Button>
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === 'runs' ? <RunsTab /> : <AnalyticsTab />}
      </div>

      {/* Add Reference Run Modal */}
      <AddReferenceRunModal
        isOpen={showAddReferenceModal}
        onClose={() => setShowAddReferenceModal(false)}
        onSuccess={() => {
          loadFilteredRuns();
          loadRunStats();
        }}
      />
    </div>
  );
}
