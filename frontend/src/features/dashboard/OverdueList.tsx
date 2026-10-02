import { formatOverdue } from "../../utils/format";
import type { DashboardTenner } from "./api";
import { DashboardTennerCard } from "./DashboardTennerCard";
import { TennerSection } from "./TennerSection";

export function OverdueList({ tenners }: { readonly tenners: readonly DashboardTenner[] }) {
  return (
    <TennerSection title="Überfällig" items={tenners}>
      {(tenner) => (
        <DashboardTennerCard
          tenner={tenner}
          variant="overdue"
          status={formatOverdue(tenner.overdueDays ?? 1)}
          completable
        />
      )}
    </TennerSection>
  );
}
