import { useCallback, useSyncExternalStore } from 'react';
import {
  listLibrary,
  removeFromLibrary,
  saveToLibrary,
} from '../lib/library';
import type { LibraryItem } from '../lib/types-meditation';

type LibraryState = {
  items: LibraryItem[];
  loading: boolean;
  loaded: boolean;
  error: string | null;
};

let state: LibraryState = {
  items: [],
  loading: false,
  loaded: false,
  error: null,
};

const subs = new Set<() => void>();

const notify = () => subs.forEach((fn) => fn());

const setState = (next: Partial<LibraryState>) => {
  state = { ...state, ...next };
  notify();
};

const subscribe = (fn: () => void) => {
  subs.add(fn);
  return () => {
    subs.delete(fn);
  };
};

const getSnapshot = () => state;

async function refresh(): Promise<void> {
  setState({ loading: true, error: null });
  try {
    const items = await listLibrary();
    setState({ items, loading: false, loaded: true });
  } catch (err) {
    setState({
      loading: false,
      loaded: true,
      error: err instanceof Error ? err.message : 'failed to load library',
    });
  }
}

async function save(meditationId: string): Promise<void> {
  setState({ error: null });
  try {
    const items = await saveToLibrary(meditationId);
    setState({ items, loaded: true });
  } catch (err) {
    setState({ error: err instanceof Error ? err.message : 'failed to save' });
    throw err;
  }
}

async function remove(meditationId: string): Promise<void> {
  setState({ error: null });
  try {
    const items = await removeFromLibrary(meditationId);
    setState({ items });
  } catch (err) {
    setState({ error: err instanceof Error ? err.message : 'failed to remove' });
    throw err;
  }
}

const isSaved = (meditationId: string): boolean =>
  state.items.some((item) => item.meditationId === meditationId);

export const libraryApi = { refresh, save, remove, isSaved };

export function useLibrary() {
  const value = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const refreshCb = useCallback(() => refresh(), []);
  const saveCb = useCallback((meditationId: string) => save(meditationId), []);
  const removeCb = useCallback(
    (meditationId: string) => remove(meditationId),
    [],
  );
  return { ...value, refresh: refreshCb, save: saveCb, remove: removeCb, isSaved };
}
