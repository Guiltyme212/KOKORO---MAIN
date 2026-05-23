import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type { LibraryItem } from "@domain/library/library-item";
import { useCases } from "./composition-root";

export const LIBRARY_QUERY_KEY = ["library"] as const;

export const useLibraryQuery = () =>
  useQuery({
    queryKey: LIBRARY_QUERY_KEY,
    queryFn: () => useCases.listLibrary(),
    staleTime: 30_000,
  });

export const useSaveToLibraryMutation = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (item: LibraryItem) => useCases.saveToLibrary(item),
    onSuccess: (items) => {
      qc.setQueryData<LibraryItem[]>(LIBRARY_QUERY_KEY, items);
    },
  });
};

export const useRemoveFromLibraryMutation = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (meditationId: string) => useCases.removeFromLibrary(meditationId),
    onSuccess: (items) => {
      qc.setQueryData<LibraryItem[]>(LIBRARY_QUERY_KEY, items);
    },
  });
};
