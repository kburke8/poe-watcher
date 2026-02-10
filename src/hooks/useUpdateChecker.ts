import { useState, useEffect, useCallback, useRef } from 'react';
import { check, type Update } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';

interface UpdateState {
  available: boolean;
  version: string | null;
  checking: boolean;
  downloading: boolean;
  progress: number;
  error: string | null;
}

export function useUpdateChecker(autoCheck: boolean) {
  const [state, setState] = useState<UpdateState>({
    available: false,
    version: null,
    checking: false,
    downloading: false,
    progress: 0,
    error: null,
  });
  const updateRef = useRef<Update | null>(null);

  const checkForUpdate = useCallback(async () => {
    setState((s) => ({ ...s, checking: true, error: null }));
    try {
      const update = await check();
      if (update) {
        updateRef.current = update;
        setState((s) => ({
          ...s,
          available: true,
          version: update.version,
          checking: false,
        }));
      } else {
        setState((s) => ({ ...s, checking: false }));
      }
    } catch (e) {
      setState((s) => ({
        ...s,
        checking: false,
        error: e instanceof Error ? e.message : String(e),
      }));
    }
  }, []);

  const downloadAndInstall = useCallback(async () => {
    const update = updateRef.current;
    if (!update) return;

    setState((s) => ({ ...s, downloading: true, progress: 0, error: null }));
    try {
      let contentLength = 0;
      let downloaded = 0;
      await update.downloadAndInstall((event) => {
        if (event.event === 'Started' && event.data.contentLength) {
          contentLength = event.data.contentLength;
        } else if (event.event === 'Progress') {
          downloaded += event.data.chunkLength;
          if (contentLength > 0) {
            setState((s) => ({
              ...s,
              progress: Math.round((downloaded / contentLength) * 100),
            }));
          }
        }
      });
      await relaunch();
    } catch (e) {
      setState((s) => ({
        ...s,
        downloading: false,
        error: e instanceof Error ? e.message : String(e),
      }));
    }
  }, []);

  useEffect(() => {
    if (!autoCheck) return;
    const timer = setTimeout(checkForUpdate, 5000);
    return () => clearTimeout(timer);
  }, [autoCheck, checkForUpdate]);

  return { ...state, checkForUpdate, downloadAndInstall };
}
