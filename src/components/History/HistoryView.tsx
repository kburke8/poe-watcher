import { useState, useEffect } from 'react';
import { useRunStore } from '../../stores/runStore';
import { RunFilter } from '../Shared/RunFilter';
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
        <h1 className="text-2xl font-bold text-[--color-text]">Run History</h1>
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
        <div className="flex gap-1">
          <button
            onClick={() => setActiveTab('runs')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === 'runs'
                ? 'bg-[--color-poe-gold] text-[--color-poe-darker]'
                : 'bg-[--color-surface] text-[--color-text-muted] hover:text-[--color-text]'
            }`}
          >
            Runs
          </button>
          <button
            onClick={() => setActiveTab('analytics')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === 'analytics'
                ? 'bg-[--color-poe-gold] text-[--color-poe-darker]'
                : 'bg-[--color-surface] text-[--color-text-muted] hover:text-[--color-text]'
            }`}
          >
            Analytics
          </button>
        </div>
        <button
          onClick={() => setShowAddReferenceModal(true)}
          className="px-4 py-2 bg-[--color-poe-gem] text-white rounded-lg text-sm font-medium hover:bg-teal-600 transition-colors"
        >
          + Add Reference Run
        </button>
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
