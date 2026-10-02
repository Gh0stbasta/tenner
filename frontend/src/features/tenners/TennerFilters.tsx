/** Status, user, category and sort filters (FRONTEND-003). */

import { MenuItem, TextField } from "@mui/material";
import Grid from "@mui/material/Grid";
import { CATEGORIES, CATEGORY_LABELS, USER_IDS, USER_LABELS, type Category, type UserId } from "../../types/domain";
import { SORT_FIELDS, type SortField, type SortOrder, type StatusFilter, type TennerListParams } from "./api";

const STATUS_LABELS: Readonly<Record<StatusFilter, string>> = { active: "Aktiv", archived: "Archiviert", all: "Alle" };
const SORT_LABELS: Readonly<Record<SortField, string>> = {
  nextDue: "Fälligkeit",
  title: "Titel",
  createdAt: "Erstellt",
  updatedAt: "Geändert",
};
const ORDER_LABELS: Readonly<Record<SortOrder, string>> = { asc: "Aufsteigend", desc: "Absteigend" };
const ALL = "ALL";

export interface TennerFiltersProps {
  readonly value: TennerListParams;
  readonly onChange: (value: TennerListParams) => void;
}

interface SelectProps<T extends string> {
  readonly label: string;
  readonly value: T;
  readonly options: readonly T[];
  readonly labels: Readonly<Record<T, string>>;
  readonly onChange: (value: T) => void;
}

function Select<T extends string>({ label, value, options, labels, onChange }: SelectProps<T>) {
  return (
    <TextField
      select
      size="small"
      fullWidth
      label={label}
      value={value}
      onChange={(event) => onChange(event.target.value as T)}
    >
      {options.map((option) => (
        <MenuItem key={option} value={option}>
          {labels[option]}
        </MenuItem>
      ))}
    </TextField>
  );
}

export function TennerFilters({ value, onChange }: TennerFiltersProps) {
  const set = (patch: Partial<TennerListParams>) => onChange({ ...value, ...patch });
  return (
    <Grid container spacing={1.5} component="section" aria-label="Filter">
      <Grid size={{ xs: 6, md: 2.4 }}>
        <Select
          label="Status"
          value={value.status}
          options={["active", "archived", "all"]}
          labels={STATUS_LABELS}
          onChange={(status) => set({ status })}
        />
      </Grid>
      <Grid size={{ xs: 6, md: 2.4 }}>
        <Select<UserId | typeof ALL>
          label="Person"
          value={value.assignedTo ?? ALL}
          options={[ALL, ...USER_IDS]}
          labels={{ ALL: "Alle", ...USER_LABELS }}
          onChange={(user) => set({ assignedTo: user === ALL ? undefined : user })}
        />
      </Grid>
      <Grid size={{ xs: 12, md: 2.4 }}>
        <Select<Category | typeof ALL>
          label="Kategorie"
          value={value.category ?? ALL}
          options={[ALL, ...CATEGORIES]}
          labels={{ ALL: "Alle", ...CATEGORY_LABELS }}
          onChange={(category) => set({ category: category === ALL ? undefined : category })}
        />
      </Grid>
      <Grid size={{ xs: 6, md: 2.4 }}>
        <Select
          label="Sortierung"
          value={value.sort}
          options={SORT_FIELDS}
          labels={SORT_LABELS}
          onChange={(sort) => set({ sort })}
        />
      </Grid>
      <Grid size={{ xs: 6, md: 2.4 }}>
        <Select
          label="Richtung"
          value={value.order}
          options={["asc", "desc"]}
          labels={ORDER_LABELS}
          onChange={(order) => set({ order })}
        />
      </Grid>
    </Grid>
  );
}
