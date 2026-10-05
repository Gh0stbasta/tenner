import AddIcon from "@mui/icons-material/Add";
import { Box, Button, TextField } from "@mui/material";
import { QUICK_ADD_INPUT_ID } from "./quickAdd";

export interface QuickAddInputProps {
  readonly value: string;
  readonly error?: string | undefined;
  readonly helperText?: string | undefined;
  readonly busy: boolean;
  readonly onChange: (value: string) => void;
  readonly onSubmit: () => void;
  /** Focus the input on mount (app shortcut "Neuer Tenner", MOBILE-001). */
  readonly autoFocus?: boolean;
}

/** Single-line input; Enter and the Add button submit. */
export function QuickAddInput({
  value,
  error,
  helperText,
  busy,
  onChange,
  onSubmit,
  autoFocus = false,
}: QuickAddInputProps) {
  return (
    <Box
      component="form"
      role="search"
      aria-label="Schnell anlegen"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
      sx={{ display: "flex", gap: 1, alignItems: "flex-start" }}
    >
      <TextField
        label="Was soll ein Tenner werden?"
        placeholder="z. B. Büro saugen"
        size="small"
        fullWidth
        id={QUICK_ADD_INPUT_ID}
        autoFocus={autoFocus}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        error={error !== undefined}
        helperText={error ?? helperText}
        slotProps={{ htmlInput: { maxLength: 120, enterKeyHint: "done" } }}
      />
      {/* Icon-only on phones, so the input keeps enough width for its label. */}
      <Button
        type="submit"
        variant="contained"
        aria-label="Hinzufügen"
        disabled={busy}
        sx={{ flexShrink: 0, minHeight: 40, minWidth: 44, px: { xs: 1, sm: 2 } }}
      >
        <AddIcon sx={{ mr: { xs: 0, sm: 1 } }} />
        <Box component="span" sx={{ display: { xs: "none", sm: "inline" } }}>
          Hinzufügen
        </Box>
      </Button>
    </Box>
  );
}
