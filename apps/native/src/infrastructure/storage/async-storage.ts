import AsyncStorage from "@react-native-async-storage/async-storage";

import type { KeyValueStoragePort } from "@application/ports/storage.port";

export const asyncStorageAdapter: KeyValueStoragePort = {
  get: (key) => AsyncStorage.getItem(key),
  set: (key, value) => AsyncStorage.setItem(key, value),
  remove: (key) => AsyncStorage.removeItem(key),
};

export class JsonRepository<T> {
  constructor(
    private readonly storage: KeyValueStoragePort,
    private readonly key: string,
    private readonly fallback: T,
  ) {}

  async read(): Promise<T> {
    const raw = await this.storage.get(this.key);
    if (!raw) return this.fallback;
    try {
      const parsed = JSON.parse(raw) as Partial<T>;
      // Shallow-merge with the fallback so newly-added fields stay defined.
      return { ...this.fallback, ...parsed } as T;
    } catch {
      return this.fallback;
    }
  }

  async write(value: T): Promise<void> {
    await this.storage.set(this.key, JSON.stringify(value));
  }

  async clear(): Promise<void> {
    await this.storage.remove(this.key);
  }
}
