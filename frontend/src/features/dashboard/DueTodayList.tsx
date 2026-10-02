import type { DashboardTenner } from "./api";
import { DashboardTennerCard } from "./DashboardTennerCard";
import { TennerSection } from "./TennerSection";

export function DueTodayList({ tenners }: { readonly tenners: readonly DashboardTenner[] }) {
  return (
    <TennerSection title="Heute fällig" items={tenners}>
      {(tenner) => <DashboardTennerCard tenner={tenner} variant="dueToday" completable />}
    </TennerSection>
  );
}
