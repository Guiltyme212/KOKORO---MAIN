// RN library is local-only (per spec decision). The same `LibraryPort`
// interface is honored; multi-device sync is a deferred follow-up.

import type { LibraryItem } from "@domain/library/library-item";
import type { LibraryPort } from "@application/ports/library.port";
import { localLibraryRepository } from "@infrastructure/storage/local-library.repository";

export const libraryApi: LibraryPort = {
  list: () => localLibraryRepository.list(),
  save: (item: LibraryItem) => localLibraryRepository.save(item),
  remove: (meditationId: string) => localLibraryRepository.remove(meditationId),
  isSaved: (meditationId: string) => localLibraryRepository.isSaved(meditationId),
};
