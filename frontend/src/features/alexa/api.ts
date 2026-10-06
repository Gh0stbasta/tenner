/** Alexa speaker mappings (ALEXA-002): which recognized voice belongs to which household member. */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { apiClient } from "../../api/client";
import { queryKeys } from "../../api/queryKeys";

const alexaContextSchema = z.object({
  account: z.object({ userId: z.string() }),
  members: z.array(z.object({ userId: z.string(), displayName: z.string() })),
  speakers: z.array(z.object({ personId: z.string(), userId: z.string() })),
});
export type AlexaContext = z.infer<typeof alexaContextSchema>;
export type AlexaSpeaker = AlexaContext["speakers"][number];

export function useAlexaSpeakers() {
  return useQuery({
    queryKey: queryKeys.alexa,
    queryFn: () => apiClient.get("/household/alexa", { schema: alexaContextSchema }),
    staleTime: 60_000,
  });
}

export function useUnlinkAlexaSpeaker() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (personId: string) =>
      apiClient.delete(`/household/alexa-speakers/${encodeURIComponent(personId)}`, { schema: alexaContextSchema }),
    onSuccess: (context) => queryClient.setQueryData(queryKeys.alexa, context),
  });
}
