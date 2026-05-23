import { useQuery } from "@tanstack/react-query";

import { ports } from "./composition-root";

export const useElevenLabsTokenQuery = (participantName?: string) =>
  useQuery({
    queryKey: ["elevenlabs-token", participantName ?? ""],
    queryFn: () => ports.elevenlabs.getConversationToken(participantName),
    // Tokens are single-use per conversation session — we don't cache
    // across re-renders or remounts.
    staleTime: 0,
    gcTime: 0,
  });
