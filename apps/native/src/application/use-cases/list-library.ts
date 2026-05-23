import type { LibraryItem } from "@domain/library/library-item";
import type { LibraryPort } from "@application/ports/library.port";

export const listLibrary =
  ({ library }: { library: LibraryPort }) =>
  (): Promise<LibraryItem[]> =>
    library.list();

export const removeFromLibrary =
  ({ library }: { library: LibraryPort }) =>
  (meditationId: string): Promise<LibraryItem[]> =>
    library.remove(meditationId);
