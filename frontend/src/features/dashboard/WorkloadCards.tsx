/** Actionable workload grouped by user and by category (FRONTEND-002). */

import { Card, CardContent, List, ListItem, ListItemText, Typography } from "@mui/material";
import { CATEGORIES, CATEGORY_LABELS, USER_IDS, USER_LABELS } from "../../types/domain";
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
                  secondary={`${formatTennerCount(group.count)} · ${formatMinutes(group.estimatedMinutes)}`}
                />
              </ListItem>
            ))}
          </List>
        )}
      </CardContent>
    </Card>
  );
}

export function UserSummaryCard({
  byUser,
}: {
  readonly byUser: WorkloadCardProps<(typeof USER_IDS)[number]>["groups"];
}) {
  return <WorkloadCard title="Nach Person" keys={USER_IDS} labels={USER_LABELS} groups={byUser} />;
}

export function CategorySummaryCard({
  byCategory,
}: {
  readonly byCategory: WorkloadCardProps<(typeof CATEGORIES)[number]>["groups"];
}) {
  return <WorkloadCard title="Nach Kategorie" keys={CATEGORIES} labels={CATEGORY_LABELS} groups={byCategory} />;
}
