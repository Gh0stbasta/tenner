import { formatOverdue } from "../../utils/format";
import { DashboardTennerCard } from "./DashboardTennerCard";
import type { CompletableListProps } from "./DueTodayList";
import { TennerSection } from "./TennerSection";

export function OverdueList({ tenners, onComplete, completingId }: CompletableListProps) {
  return (
    <TennerSection title="Überfällig" count={tenners.length}>
      {tenners.map((tenner) => (
        <DashboardTennerCard
          key={tenner.tennerId}
          tenner={tenner}
          variant="overdue"
          status={formatOverdue(tenner.overdueDays ?? 1)}
          onComplete={onComplete}
          completing={completingId === tenner.tennerId}
        />
      ))}
    </TennerSection>
  );
}
