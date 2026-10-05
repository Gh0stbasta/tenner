/** Paused Tenners (SCHEDULING-005): out of the due lists, shown with their pause end. */

import { formatShortDate } from "../../utils/format";
import type { PausedDashboardTenner } from "./api";
import { DashboardTennerCard } from "./DashboardTennerCard";
import { TennerSection } from "./TennerSection";

function pauseLabel(tenner: PausedDashboardTenner): string {
  const until = tenner.pausedUntil === null ? "bis auf Weiteres" : `bis ${formatShortDate(tenner.pausedUntil)}`;
  return tenner.pauseReason === "VACATION" ? `Urlaub ${until}` : `Pausiert ${until}`;
}

export function PausedList({ tenners }: { readonly tenners: readonly PausedDashboardTenner[] }) {
  return (
    <TennerSection title="Pausiert" items={tenners}>
      {(tenner) => <DashboardTennerCard tenner={tenner} variant="upcoming" status={pauseLabel(tenner)} />}
    </TennerSection>
  );
}
