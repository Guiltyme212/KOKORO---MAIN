import type { LibraryItem } from "@domain/library/library-item";

export interface LibraryPort {
  list(): Promise<LibraryItem[]>;
  save(item: LibraryItem): Promise<LibraryItem[]>;
  remove(meditationId: string): Promise<LibraryItem[]>;
  isSaved(meditationId: string): Promise<boolean>;
}
