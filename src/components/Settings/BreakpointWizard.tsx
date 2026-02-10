import { useState, useMemo, Fragment } from 'react';
import type { WizardConfig } from '../../types';
import { generateBreakpoints, groupByAct, DEFAULT_WIZARD_CONFIG } from '../../config/wizardRoutes';
import { useSettingsStore } from '../../stores/settingsStore';

const WIZARD_STORAGE_KEY = 'poe-watcher-wizard-config';

type Step = 1 | 2 | 3;

const STEP_LABELS = ['Category', 'Splits', 'Snapshots'] as const;

function getStepSummary(step: number, config: WizardConfig): string {
  switch (step) {
    case 1:
      return `Act ${config.endAct} ${config.runType === 'any_percent' ? 'Any%' : '100%'}`;
    case 2:
      return ({
        every_zone: 'Every Zone',
        key_zones: 'Key Zones',
        bosses_only: 'Bosses Only',
        acts_only: 'Acts Only',
      } as Record<string, string>)[config.verbosity] ?? config.verbosity;
    case 3: {
      const freq = config.snapshotFrequency || 'acts_only';
      return freq === 'bosses_only' ? 'Bosses + Acts' : 'Acts Only';
    }
    default:
      return '';
  }
}

export function BreakpointWizard() {
  const { wizardConfig, setWizardConfig } = useSettingsStore();

  // Local wizard state (committed on Apply)
  // Migrate older configs that may lack snapshotFrequency
  const [config, setConfig] = useState<WizardConfig>(() => {
    const saved = wizardConfig ?? DEFAULT_WIZARD_CONFIG;
    if (!saved.snapshotFrequency) {
      return { ...saved, snapshotFrequency: 'acts_only' as const };
    }
    return saved;
  });
  const [step, setStep] = useState<Step>(1);

  // Preview: generate breakpoints from current local config
  const preview = useMemo(() => generateBreakpoints(config), [config]);
  const enabledCount = useMemo(() => preview.filter(bp => bp.isEnabled).length, [preview]);
  const snapshotCount = useMemo(() => preview.filter(bp => bp.isEnabled && bp.captureSnapshot).length, [preview]);
  const grouped = useMemo(() => groupByAct(preview), [preview]);

  const handleApply = () => {
    setWizardConfig(config);
    try {
      localStorage.setItem(WIZARD_STORAGE_KEY, JSON.stringify(config));
    } catch (e) {
      console.error('Failed to save wizard config:', e);
    }
  };

  return (
    <div className="space-y-4">
      {/* Sequential stepper — timeline */}
      <div className="flex items-start mb-2">
        {STEP_LABELS.map((label, i) => {
          const num = (i + 1) as Step;
          const isActive = num === step;
          const isCompleted = num < step;
          const isFuture = num > step;
          return (
            <Fragment key={num}>
              {i > 0 && (
                <div className={`flex-1 h-[2px] mt-[13px] ${isFuture ? 'bg-[--color-border]/60' : 'bg-[--color-poe-gold]'}`} />
              )}
              <button
                onClick={() => setStep(num)}
                className="flex flex-col items-center min-w-[5rem] cursor-pointer"
              >
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all ${
                  isActive
                    ? 'bg-[--color-poe-gold] text-[--color-poe-darker] border-[--color-poe-gold-light] shadow-[0_0_12px_rgba(175,141,64,0.6)]'
                    : isCompleted
                    ? 'bg-[--color-poe-gold] text-[--color-poe-darker] border-[--color-poe-gold]'
                    : 'bg-[--color-surface] text-[--color-text-muted] border-[--color-border]/60'
                }`}>
                  {isCompleted ? (
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : num}
                </div>
                <span className={`text-[11px] mt-1.5 leading-tight ${
                  isActive ? 'text-[--color-poe-gold] font-semibold' : isCompleted ? 'text-[--color-text-muted]' : 'text-[--color-text-muted]/50'
                }`}>
                  {label}
                </span>
                <span className={`text-[10px] mt-0.5 leading-tight text-center max-w-[5.5rem] ${
                  isActive ? 'text-[--color-poe-gold] font-medium' : isCompleted ? 'text-[--color-text-muted]' : 'text-transparent'
                }`}>
                  {getStepSummary(num, config)}
                </span>
              </button>
            </Fragment>
          );
        })}
      </div>

      {/* Step content */}
      <div className="bg-[--color-surface] rounded-lg p-4">
        {step === 1 && <StepCategory config={config} setConfig={setConfig} onAdvance={() => setStep(2)} />}
        {step === 2 && <StepVerbosity config={config} setConfig={setConfig} onAdvance={() => setStep(3)} />}
        {step === 3 && <StepSnapshots config={config} setConfig={setConfig} onAdvance={() => {}} />}
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => setStep(Math.max(1, step - 1) as Step)}
          disabled={step === 1}
          className="px-4 py-2 text-sm bg-[--color-surface] text-[--color-text] rounded-md border-2 border-[--color-poe-gold]/40 shadow-sm hover:border-[--color-poe-gold]/70 hover:shadow-md active:scale-95 transition-all font-medium disabled:opacity-30 disabled:cursor-not-allowed"
        >
          Back
        </button>
        <div className="flex items-center gap-3">
          {step < 3 && (
            <button
              onClick={() => setStep(Math.min(3, step + 1) as Step)}
              className="px-4 py-2 text-sm bg-[--color-surface] text-[--color-text] rounded-md border-2 border-[--color-poe-gold]/40 shadow-sm hover:border-[--color-poe-gold]/70 hover:shadow-md active:scale-95 transition-all font-medium"
            >
              Next
            </button>
          )}
          <button
            onClick={handleApply}
            className="px-5 py-2 text-sm bg-[--color-poe-gold] text-[--color-poe-darker] rounded-md border border-[--color-poe-gold-light] shadow-sm hover:bg-[--color-poe-gold-light] hover:shadow-md active:scale-95 transition-all font-semibold"
          >
            Apply ({enabledCount} splits, {snapshotCount} snaps)
          </button>
        </div>
      </div>

      {/* Preview panel */}
      <details className="bg-[--color-surface] rounded-lg overflow-hidden" open>
        <summary className="p-3 cursor-pointer text-sm font-medium text-[--color-text] hover:bg-[--color-surface-elevated]/50 select-none">
          Preview — {enabledCount} splits, {snapshotCount} snapshots
        </summary>
        <div className="px-4 pb-3 max-h-48 overflow-auto">
          {Array.from(grouped.entries())
            .sort(([a], [b]) => a - b)
            .map(([act, bps]) => (
              <div key={act} className="mb-2">
                <div className="text-xs font-semibold text-[--color-poe-gold] mb-1">
                  {act === 0 ? 'Level Milestones' : `Act ${act}`}
                  <span className="text-[--color-text-muted] font-normal ml-1">({bps.length})</span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {bps.map(bp => (
                    <span
                      key={bp.name}
                      className={`text-xs px-1.5 py-0.5 rounded ${
                        bp.type === 'boss'
                          ? 'bg-red-900/30 text-red-300'
                          : bp.type === 'act'
                          ? 'bg-amber-900/30 text-amber-300'
                          : 'bg-[--color-surface-elevated] text-[--color-text-muted]'
                      } ${bp.captureSnapshot ? 'ring-1 ring-blue-400/50' : ''}`}
                    >
                      {bp.name}
                      {bp.captureSnapshot && <span className="ml-0.5 text-blue-400 text-[10px]">S</span>}
                    </span>
                  ))}
                </div>
              </div>
            ))}
        </div>
      </details>
    </div>
  );
}

// ── Step 1: Category ───────────────────────────────────────────────

function StepCategory({ config, setConfig, onAdvance }: {
  config: WizardConfig;
  setConfig: (fn: (prev: WizardConfig) => WizardConfig) => void;
  onAdvance: () => void;
}) {
  const cards: { endAct: 5 | 10; runType: 'any_percent' | 'hundred_percent'; title: string; desc: string }[] = [
    { endAct: 5, runType: 'any_percent', title: 'Acts 1-5 Any%', desc: 'Kill Kitava Act 5' },
    { endAct: 5, runType: 'hundred_percent', title: 'Acts 1-5 100%', desc: 'Full clear through Act 5 (routing options coming soon)' },
    { endAct: 10, runType: 'any_percent', title: 'Acts 1-10 Any%', desc: 'Full campaign to maps' },
    { endAct: 10, runType: 'hundred_percent', title: 'Acts 1-10 100%', desc: 'Full campaign, all quests (routing options coming soon)' },
  ];

  return (
    <div>
      <h3 className="text-sm font-semibold text-[--color-text] mb-3">Which acts and run type?</h3>
      <div className="grid grid-cols-2 gap-3">
        {cards.map(card => {
          const selected = config.endAct === card.endAct && config.runType === card.runType;
          return (
            <button
              key={`${card.endAct}-${card.runType}`}
              onClick={() => { setConfig(prev => ({ ...prev, endAct: card.endAct, runType: card.runType })); onAdvance(); }}
              className={`p-4 rounded-lg text-left transition-all active:scale-[0.98] relative ${
                selected
                  ? 'border-2 border-[--color-poe-gold] bg-[--color-poe-gold]/20 shadow-[0_0_12px_rgba(175,141,64,0.3)]'
                  : 'border border-[--color-border]/40 bg-[--color-surface-elevated] hover:border-[--color-border]'
              }`}
            >
              {selected && (
                <div className="absolute top-2.5 right-2.5 w-5 h-5 rounded-full bg-[--color-poe-gold] flex items-center justify-center">
                  <svg className="w-3 h-3 text-[--color-poe-darker]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              )}
              <div className={`font-medium ${selected ? 'text-[--color-poe-gold]' : 'text-[--color-text]'}`}>
                {card.title}
              </div>
              <div className="text-xs text-[--color-text-muted] mt-1">{card.desc}</div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Step 2: Verbosity ──────────────────────────────────────────────

function StepVerbosity({ config, setConfig, onAdvance }: {
  config: WizardConfig;
  setConfig: (fn: (prev: WizardConfig) => WizardConfig) => void;
  onAdvance: () => void;
}) {
  const options: { value: WizardConfig['verbosity']; label: string; desc: string }[] = [
    { value: 'every_zone', label: 'Every Zone', desc: 'Split on every zone transition' },
    { value: 'key_zones', label: 'Key Zones', desc: 'Important zones and bosses (recommended)' },
    { value: 'bosses_only', label: 'Bosses Only', desc: 'Only boss encounters and act transitions' },
    { value: 'acts_only', label: 'Acts Only', desc: 'Only act transitions and Kitava kills' },
  ];

  return (
    <div>
      <h3 className="text-sm font-semibold text-[--color-text] mb-3">How many splits?</h3>
      <div className="space-y-2">
        {options.map(opt => {
          const selected = config.verbosity === opt.value;
          // Calculate split count for this verbosity
          const count = generateBreakpoints({ ...config, verbosity: opt.value }).filter(bp => bp.isEnabled).length;
          return (
            <button
              key={opt.value}
              onClick={() => { setConfig(prev => ({ ...prev, verbosity: opt.value })); onAdvance(); }}
              className={`w-full p-3 rounded-lg text-left transition-all active:scale-[0.99] ${
                selected
                  ? 'border-2 border-[--color-poe-gold] bg-[--color-poe-gold]/20 shadow-[0_0_10px_rgba(175,141,64,0.25)]'
                  : 'border border-[--color-border]/40 bg-[--color-surface-elevated] hover:border-[--color-border]'
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <span className={`font-medium ${selected ? 'text-[--color-poe-gold]' : 'text-[--color-text]'}`}>
                    {opt.label}
                  </span>
                  <span className="text-xs text-[--color-text-muted] ml-2">~{count} splits</span>
                </div>
                <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                  selected ? 'border-[--color-poe-gold]' : 'border-[--color-text-muted]/40'
                }`}>
                  {selected && <div className="w-2 h-2 rounded-full bg-[--color-poe-gold]" />}
                </div>
              </div>
              <div className="text-xs text-[--color-text-muted] mt-1">{opt.desc}</div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Step 3: Snapshot Frequency ─────────────────────────────────────

function StepSnapshots({ config, setConfig, onAdvance }: {
  config: WizardConfig;
  setConfig: (fn: (prev: WizardConfig) => WizardConfig) => void;
  onAdvance: () => void;
}) {
  const options: { value: WizardConfig['snapshotFrequency']; label: string; desc: string }[] = [
    { value: 'acts_only', label: 'Acts Only', desc: 'Capture at act transitions and Kitava kills' },
    { value: 'bosses_only', label: 'Bosses + Acts', desc: 'Capture at boss encounters and act transitions' },
  ];

  // Count snapshots for each option
  const countForOption = (freq: WizardConfig['snapshotFrequency']) => {
    const bps = generateBreakpoints({ ...config, snapshotFrequency: freq });
    return bps.filter(bp => bp.isEnabled && bp.captureSnapshot).length;
  };

  return (
    <div>
      <h3 className="text-sm font-semibold text-[--color-text] mb-1">Snapshot capture frequency</h3>
      <p className="text-xs text-[--color-text-muted] mb-3">
        Snapshots record your gear and passive tree at each capture point
      </p>
      <div className="space-y-2">
        {options.map(opt => {
          const selected = (config.snapshotFrequency || 'acts_only') === opt.value;
          const count = countForOption(opt.value);
          return (
            <button
              key={opt.value}
              onClick={() => { setConfig(prev => ({ ...prev, snapshotFrequency: opt.value })); onAdvance(); }}
              className={`w-full p-3 rounded-lg text-left transition-all active:scale-[0.99] ${
                selected
                  ? 'border-2 border-[--color-poe-gold] bg-[--color-poe-gold]/20 shadow-[0_0_10px_rgba(175,141,64,0.25)]'
                  : 'border border-[--color-border]/40 bg-[--color-surface-elevated] hover:border-[--color-border]'
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <span className={`font-medium ${selected ? 'text-[--color-poe-gold]' : 'text-[--color-text]'}`}>
                    {opt.label}
                  </span>
                  <span className="text-xs text-[--color-text-muted] ml-2">~{count} snapshots</span>
                </div>
                <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                  selected ? 'border-[--color-poe-gold]' : 'border-[--color-text-muted]/40'
                }`}>
                  {selected && <div className="w-2 h-2 rounded-full bg-[--color-poe-gold]" />}
                </div>
              </div>
              <div className="text-xs text-[--color-text-muted] mt-1">{opt.desc}</div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Standalone Route Customizations (used outside wizard) ──────────

export function RouteCustomizations() {
  const { wizardConfig, setWizardConfig } = useSettingsStore();

  if (!wizardConfig) {
    return (
      <p className="text-sm text-[--color-text-muted] p-4">
        Configure the wizard above first to enable route customizations.
      </p>
    );
  }

  const setRoute = <K extends keyof WizardConfig['routes']>(key: K, value: WizardConfig['routes'][K]) => {
    const updated = { ...wizardConfig, routes: { ...wizardConfig.routes, [key]: value } };
    setWizardConfig(updated);
    try {
      localStorage.setItem('poe-watcher-wizard-config', JSON.stringify(updated));
    } catch (e) {
      console.error('Failed to save wizard config:', e);
    }
  };

  const showAct6Plus = wizardConfig.endAct === 10;

  return (
    <div className="space-y-3">
      {/* Act 1 */}
      <RouteSection title="Act 1">
        <RadioOption
          label="Standard"
          desc="Skip or do Tidal Island later"
          selected={wizardConfig.routes.act1 === 'standard'}
          onSelect={() => setRoute('act1', 'standard')}
        />
        <RadioOption
          label="Early Dweller"
          desc="Do Tidal Island right after Mud Flats"
          selected={wizardConfig.routes.act1 === 'early_dweller'}
          onSelect={() => setRoute('act1', 'early_dweller')}
        />
      </RouteSection>

      {/* Act 2 */}
      <RouteSection title="Act 2">
        <RadioOption
          label="Standard"
          desc="Skip Fellshrine / Crypt areas"
          selected={wizardConfig.routes.act2 === 'standard'}
          onSelect={() => setRoute('act2', 'standard')}
        />
        <RadioOption
          label="Early Crypt"
          desc="Fellshrine Ruins and Crypt after Crossroads"
          selected={wizardConfig.routes.act2 === 'early_crypt'}
          onSelect={() => setRoute('act2', 'early_crypt')}
        />
      </RouteSection>

      {/* Act 4 */}
      <RouteSection title="Act 4">
        <RadioOption
          label="Standard (Daresso first)"
          desc="Grand Arena before Kaom's side"
          selected={wizardConfig.routes.act4 === 'standard'}
          onSelect={() => setRoute('act4', 'standard')}
        />
        <RadioOption
          label="Kaom First"
          desc="Kaom's Dream/Stronghold before Daresso"
          selected={wizardConfig.routes.act4 === 'kaom_first'}
          onSelect={() => setRoute('act4', 'kaom_first')}
        />
      </RouteSection>

      {/* Act 6 (only if endAct >= 6) */}
      {showAct6Plus && (
        <RouteSection title="Act 6">
          <ToggleOption
            label="Skip Twilight Strand"
            desc="Don't track Lily's zone"
            checked={wizardConfig.routes.act6SkipLily}
            onToggle={() => setRoute('act6SkipLily', !wizardConfig.routes.act6SkipLily)}
          />
          <ToggleOption
            label="Add Tidal Island"
            desc="Track Tidal Island after The Coast"
            checked={wizardConfig.routes.act6AddTidal}
            onToggle={() => setRoute('act6AddTidal', !wizardConfig.routes.act6AddTidal)}
          />
        </RouteSection>
      )}

      {/* Act 8 (only if endAct >= 8) */}
      {showAct6Plus && (
        <RouteSection title="Act 8">
          <RadioOption
            label="Standard (new meta)"
            desc="Current popular routing order"
            selected={wizardConfig.routes.act8 === 'standard'}
            onSelect={() => setRoute('act8', 'standard')}
          />
          <RadioOption
            label="Legacy"
            desc="Lunaris side before Solaris (old meta)"
            selected={wizardConfig.routes.act8 === 'legacy'}
            onSelect={() => setRoute('act8', 'legacy')}
          />
        </RouteSection>
      )}
    </div>
  );
}

// ── Shared sub-components ──────────────────────────────────────────

function RouteSection({ title, children }: { title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(true);
  return (
    <div className="border border-[--color-border] rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between p-2.5 text-sm font-medium text-[--color-text] hover:bg-[--color-surface-elevated]/50 active:scale-[0.99] transition-all"
      >
        <span>{title}</span>
        <svg
          className={`w-4 h-4 text-[--color-text-muted] transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none" stroke="currentColor" viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && <div className="px-3 pb-3 space-y-1.5">{children}</div>}
    </div>
  );
}

function RadioOption({ label, desc, selected, onSelect }: {
  label: string; desc: string; selected: boolean; onSelect: () => void;
}) {
  return (
    <button
      onClick={onSelect}
      className={`w-full flex items-start gap-3 p-2 rounded-md text-left transition-all active:scale-[0.99] ${
        selected ? 'bg-[--color-poe-gold]/10' : 'hover:bg-[--color-surface-elevated]/50'
      }`}
    >
      <div className={`mt-0.5 w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
        selected ? 'border-[--color-poe-gold]' : 'border-[--color-text-muted]'
      }`}>
        {selected && <div className="w-2 h-2 rounded-full bg-[--color-poe-gold]" />}
      </div>
      <div>
        <div className={`text-sm ${selected ? 'text-[--color-poe-gold] font-medium' : 'text-[--color-text]'}`}>
          {label}
        </div>
        <div className="text-xs text-[--color-text-muted]">{desc}</div>
      </div>
    </button>
  );
}

function ToggleOption({ label, desc, checked, onToggle }: {
  label: string; desc: string; checked: boolean; onToggle: () => void;
}) {
  return (
    <button
      onClick={onToggle}
      className={`w-full flex items-center justify-between p-2 rounded-md text-left transition-all active:scale-[0.99] ${
        checked ? 'bg-[--color-poe-gold]/10' : 'hover:bg-[--color-surface-elevated]/50'
      }`}
    >
      <div>
        <div className={`text-sm ${checked ? 'text-[--color-poe-gold] font-medium' : 'text-[--color-text]'}`}>
          {label}
        </div>
        <div className="text-xs text-[--color-text-muted]">{desc}</div>
      </div>
      <div className={`w-10 h-5 rounded-full transition-all duration-150 border flex-shrink-0 ${
        checked ? 'bg-[--color-poe-gold] border-[--color-poe-gold-light]' : 'bg-zinc-700 border-zinc-600'
      }`}>
        <div className={`w-4 h-4 rounded-full bg-white shadow transition-transform duration-150 ${
          checked ? 'translate-x-5' : 'translate-x-0.5'
        }`} />
      </div>
    </button>
  );
}
