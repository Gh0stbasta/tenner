/** Pause/resume actions plus the pause dialog for pages with Tenner actions (SCHEDULING-005). */

import { useState } from "react";
import { errorMessage } from "../../api/errorMessages";
import { useNotify } from "../../components/NotificationProvider";
import type { Tenner } from "../tenners/schemas";
import { useResumeTenner } from "./api";
import { PauseDialog } from "./PauseDialog";

export function usePauseControls() {
  const notify = useNotify();
  const resume = useResumeTenner();
  const [candidate, setCandidate] = useState<Tenner | null>(null);
  return {
    requestPause: (tenner: Tenner) => setCandidate(tenner),
    resume: (tenner: Pick<Tenner, "tennerId" | "title">) =>
      resume.mutate(tenner.tennerId, {
        onSuccess: () => notify({ message: `▶ „${tenner.title}“ fortgesetzt.` }),
        onError: (error) => notify({ message: `Fortsetzen fehlgeschlagen. ${errorMessage(error)}`, severity: "error" }),
      }),
    resumingTennerId: resume.isPending ? resume.variables : undefined,
    dialog: <PauseDialog tenner={candidate} onClose={() => setCandidate(null)} />,
  };
}
