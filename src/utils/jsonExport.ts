import { invoke } from '@tauri-apps/api/core';
import { save } from '@tauri-apps/plugin-dialog';
import type { Run } from '../types';

function sanitizeFilename(str: string): string {
  return str.replace(/[^a-zA-Z0-9_-]/g, '_').replace(/_+/g, '_');
}

export async function exportRunToJson(runId: number, run?: Run): Promise<void> {
  // Build a suggested filename
  let defaultName = `run_${runId}`;
  if (run) {
    const charPart = sanitizeFilename(run.characterName || run.character || 'unknown');
    const catPart = sanitizeFilename(run.category || 'run');
    const datePart = run.startedAt
      ? new Date(run.startedAt).toISOString().slice(0, 10)
      : new Date().toISOString().slice(0, 10);
    defaultName = `${charPart}_${catPart}_${datePart}`;
  }

  const filePath = await save({
    defaultPath: `${defaultName}.json`,
    filters: [{ name: 'JSON', extensions: ['json'] }],
  });

  if (!filePath) return; // user cancelled

  await invoke('export_run_json', { runId, filePath });
}
