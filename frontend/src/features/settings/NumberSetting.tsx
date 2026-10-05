/** Number input that keeps the typed text and saves a whole number within the range when the field is left. */

import { TextField } from "@mui/material";
import { useState } from "react";

export interface NumberSettingProps {
  readonly label: string;
  readonly value: number;
  readonly range: { readonly min: number; readonly max: number };
  readonly onSave: (value: number) => void;
  readonly disabled?: boolean;
}

export function NumberSetting({ label, value, range, onSave, disabled = false }: NumberSettingProps) {
  const [text, setText] = useState(String(value));
  // Follow outside changes (another device, "reset") without overwriting what the user is typing.
  const [savedValue, setSavedValue] = useState(value);
  if (value !== savedValue) {
    setSavedValue(value);
    if (Number(text) !== value) setText(String(value));
  }
  const parsed = Number(text);
  const valid = text.trim() !== "" && Number.isInteger(parsed) && parsed >= range.min && parsed <= range.max;
  return (
    <TextField
      label={label}
      type="number"
      value={text}
      disabled={disabled}
      onChange={(event) => setText(event.target.value)}
      onBlur={() => {
        if (!valid) setText(String(value));
        else if (parsed !== value) onSave(parsed);
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter") (event.target as HTMLInputElement).blur();
      }}
      error={!valid}
      helperText={
        valid ? `${range.min} – ${range.max}` : `Bitte eine ganze Zahl von ${range.min} bis ${range.max} eingeben.`
      }
      slotProps={{ htmlInput: { min: range.min, max: range.max, inputMode: "numeric" } }}
      fullWidth
    />
  );
}
