import type { DashboardTenner } from "./api";
import { DashboardTennerCard } from "./DashboardTennerCard";
import { TennerSection } from "./TennerSection";

export interface CompletableListProps {
  readonly tenners: readonly DashboardTenner[];
  readonly onComplete: (tenner: DashboardTenner) => void;
  readonly completingId?: string | undefined;
}

export function DueTodayList({ tenners, onComplete, completingId }: CompletableListProps) {
  return (
    <TennerSection title="Heute fällig" count={tenners.length}>
      {tenners.map((tenner) => (
        <DashboardTennerCard
          key={tenner.tennerId}
          tenner={tenner}
          variant="dueToday"
          onComplete={onComplete}
          completing={completingId === tenner.tennerId}
        />
      ))}
    </TennerSection>
  );
}
