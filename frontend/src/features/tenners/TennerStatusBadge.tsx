import { Chip, type ChipProps } from "@mui/material";
import type { TennerStatus, TennerStatusKind } from "./status";

const COLORS: Readonly<Record<TennerStatusKind, ChipProps["color"]>> = {
  archived: "default",
  inactive: "default",
  overdue: "error",
  dueToday: "primary",
  upcoming: "default",
};

export function TennerStatusBadge({ status }: { readonly status: TennerStatus }) {
  return (
    <Chip
      size="small"
      label={status.label}
      color={COLORS[status.kind]}
      variant={status.kind === "upcoming" || status.kind === "inactive" ? "outlined" : "filled"}
    />
  );
}
