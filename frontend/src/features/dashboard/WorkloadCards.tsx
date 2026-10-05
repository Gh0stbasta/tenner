/** Actionable workload grouped by user and by category (FRONTEND-002). */

import { Card, CardContent, List, ListItem, ListItemText, Typography } from "@mui/material";
import { useCategoryName, useCategories } from "../categories/api";
import { useActiveMembers, useMemberName } from "../members/api";
import { formatMinutes, formatTennerCount } from "../../utils/format";
import type { GroupSummary } from "./api";

interface WorkloadCardProps<K extends string> {
  readonly title: string;
  readonly keys: readonly K[];
  readonly labels: Readonly<Record<K, string>>;
  readonly groups: Partial<Record<K, GroupSummary>>;
}

function WorkloadCard<K extends string>({ title, keys, labels, groups }: WorkloadCardProps<K>) {
  const rows = keys.flatMap((key) => {
    const group = groups[key];
    return group ? [{ key, label: labels[key], group }] : [];
  });
  return (
    <Card component="section" aria-label={title} sx={{ mb: 2 }}>
      <CardContent>
        <Typography variant="h2" component="h2" sx={{ fontSize: "1.05rem" }}>
          {title}
        </Typography>
        {rows.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            Nichts offen.
          </Typography>
        ) : (
          <List dense disablePadding>
            {rows.map(({ key, label, group }) => (
              <ListItem key={key} disableGutters>
                <ListItemText
                  primary={label}
                  secondary={`${formatTennerCount(group.count)}${group.sharedCount ? ` (davon ${group.sharedCount} gemeinsam)` : ""} · ${formatMinutes(group.estimatedMinutes)}`}
                />
              </ListItem>
            ))}
          </List>
        )}
      </CardContent>
    </Card>
  );
}

/** Members in their configured order, then any other assignee in the data (e.g. not loaded yet). */
export function UserSummaryCard({ byUser }: { readonly byUser: Partial<Record<string, GroupSummary>> }) {
  const memberName = useMemberName();
  const ordered = useActiveMembers().map((member) => member.userId);
  const keys = [...ordered, ...Object.keys(byUser).filter((userId) => !ordered.includes(userId))];
  const labels = Object.fromEntries(keys.map((userId) => [userId, memberName(userId)]));
  return <WorkloadCard title="Nach Person" keys={keys} labels={labels} groups={byUser} />;
}

/** Categories in display order (archived included, they may still have Tenners), then any other category. */
export function CategorySummaryCard({ byCategory }: { readonly byCategory: Partial<Record<string, GroupSummary>> }) {
  const categoryName = useCategoryName();
  const ordered = (useCategories().data ?? []).map((category) => category.categoryId);
  const keys = [...ordered, ...Object.keys(byCategory).filter((categoryId) => !ordered.includes(categoryId))];
  const labels = Object.fromEntries(keys.map((categoryId) => [categoryId, categoryName(categoryId)]));
  return <WorkloadCard title="Nach Kategorie" keys={keys} labels={labels} groups={byCategory} />;
}
