/** Week | Month | Quarter | Year | Custom (ANALYTICS-009); the selection lives in the URL. */

import { Box, TextField, ToggleButton, ToggleButtonGroup } from "@mui/material";
import { useState } from "react";
import { useToday } from "../household/api";
import { PERIOD_OPTIONS, type PeriodOption, type PeriodSelection } from "./api";

const LABELS: Readonly<Record<PeriodOption | "custom", string>> = {
  week: "Woche",
  month: "Monat",
  quarter: "Quartal",
  year: "Jahr",
  custom: "Eigener Zeitraum",
};

export function PeriodSelector({
  value,
  onChange,
}: {
  readonly value: PeriodSelection;
  readonly onChange: (selection: PeriodSelection) => void;
}) {
  const today = useToday();
  const [customOpen, setCustomOpen] = useState("from" in value);
  const [from, setFrom] = useState("from" in value ? value.from : "");
  const [to, setTo] = useState("from" in value ? value.to : today);
  const selected = customOpen ? "custom" : "period" in value ? value.period : "custom";

  const applyCustom = (nextFrom: string, nextTo: string) => {
    if (nextFrom !== "" && nextTo !== "" && nextFrom <= nextTo) onChange({ from: nextFrom, to: nextTo });
  };

  return (
    <Box sx={{ display: "flex", flexWrap: "wrap", gap: 2, alignItems: "center", mb: 3 }}>
      <ToggleButtonGroup
        exclusive
        size="small"
        value={selected}
        aria-label="Zeitraum"
        onChange={(_, next: PeriodOption | "custom" | null) => {
          if (next === null) return;
          if (next === "custom") {
            setCustomOpen(true);
            return;
          }
          setCustomOpen(false);
          onChange({ period: next });
        }}
        sx={{ flexWrap: "wrap" }}
      >
        {[...PERIOD_OPTIONS, "custom" as const].map((option) => (
          <ToggleButton key={option} value={option}>
            {LABELS[option]}
          </ToggleButton>
        ))}
      </ToggleButtonGroup>
      {customOpen && (
        <Box sx={{ display: "flex", gap: 1 }}>
          <TextField
            label="Von"
            type="date"
            size="small"
            value={from}
            onChange={(event) => {
              setFrom(event.target.value);
              applyCustom(event.target.value, to);
            }}
            slotProps={{ inputLabel: { shrink: true }, htmlInput: { max: to || today } }}
          />
          <TextField
            label="Bis"
            type="date"
            size="small"
            value={to}
            error={from !== "" && to !== "" && from > to}
            helperText={from !== "" && to !== "" && from > to ? "Liegt vor dem Beginn." : undefined}
            onChange={(event) => {
              setTo(event.target.value);
              applyCustom(from, event.target.value);
            }}
            slotProps={{ inputLabel: { shrink: true }, htmlInput: { max: today } }}
          />
        </Box>
      )}
    </Box>
  );
}
