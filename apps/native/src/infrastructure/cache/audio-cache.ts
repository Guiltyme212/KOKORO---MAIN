import { Directory, File, Paths } from "expo-file-system";

// Local filesystem cache for downloaded meditation audio. We cache by
// meditationId so the same file can be played offline after the first
// online listen.

const CACHE_DIRNAME = "meditations";

const cacheDir = (): Directory => {
  const dir = new Directory(Paths.cache, CACHE_DIRNAME);
  try {
    if (!dir.exists) dir.create({ intermediates: true });
  } catch {
    /* directory may already exist on a hot reload */
  }
  return dir;
};

const fileFor = (meditationId: string): File =>
  new File(cacheDir(), `${meditationId}.m4a`);

export const audioCache = {
  /**
   * Returns the local file URI if the audio is cached, otherwise null.
   */
  localUri(meditationId: string): string | null {
    try {
      const f = fileFor(meditationId);
      return f.exists ? f.uri : null;
    } catch {
      return null;
    }
  },

  /**
   * Download the remote URL into the cache. Idempotent: if the file already
   * exists, returns the existing URI immediately.
   */
  async ensure(meditationId: string, remoteUrl: string): Promise<string> {
    try {
      const f = fileFor(meditationId);
      if (f.exists) return f.uri;
      const downloaded = await File.downloadFileAsync(remoteUrl, f, {
        idempotent: true,
      });
      return downloaded.uri;
    } catch {
      // Caching is best-effort — fall back to streaming from the remote URL.
      return remoteUrl;
    }
  },

  async remove(meditationId: string): Promise<void> {
    try {
      const f = fileFor(meditationId);
      if (f.exists) f.delete();
    } catch {
      /* swallow */
    }
  },

  async clear(): Promise<void> {
    try {
      const dir = cacheDir();
      if (dir.exists) dir.delete();
    } catch {
      /* swallow */
    }
  },
};
