import { formatDueIn } from "../../utils/format";
import type { DashboardTenner } from "./api";
import { DashboardTennerCard } from "./DashboardTennerCard";
import { TennerSection } from "./TennerSection";

/** Upcoming Tenners are informational; completing early is possible from the Tenners page. */
export function UpcomingList({ tenners }: { readonly tenners: readonly DashboardTenner[] }) {
  return (
    <TennerSection title="Demnächst" count={tenners.length}>
      {tenners.map((tenner) => (
        <DashboardTennerCard
          key={tenner.tennerId}
          tenner={tenner}
          variant="upcoming"
          status={formatDueIn(tenner.daysUntilDue ?? 1)}
        />
      ))}
    </TennerSection>
  );
}
