/**
 * „KI-Prompt kopieren“ and „JSON übernehmen“ in the editor for a new dish (MAINT-012): the prompt goes to the clipboard
 * for any chat AI, the AI's JSON answer is pasted back and fills the editor (nothing is saved here).
 */

import AutoAwesomeOutlinedIcon from "@mui/icons-material/AutoAwesomeOutlined";
import ContentCopyOutlinedIcon from "@mui/icons-material/ContentCopyOutlined";
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { useId, useState } from "react";
import { useNotify } from "../../components/NotificationProvider";
import type { Ingredient } from "./api";
import type { DishInput } from "./dishes";
import { buildDishPrompt, parseDishJson } from "./dishImport";

export interface DishAiImportProps {
  readonly catalog: readonly Ingredient[];
  readonly disabled: boolean;
  readonly onImport: (draft: DishInput, unknownIngredients: readonly string[]) => void;
}

export function DishAiImport({ catalog, disabled, onImport }: DishAiImportProps) {
  const notify = useNotify();
  const titleId = useId();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);

  const copyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(buildDishPrompt(catalog));
      notify({ message: "Prompt kopiert. In eine Chat-KI einfügen und das Gericht beschreiben." });
    } catch {
      notify({ message: "Kopieren hat nicht geklappt.", severity: "error" });
    }
  };
  const close = () => {
    setOpen(false);
    setText("");
    setError(null);
  };
  const apply = () => {
    const result = parseDishJson(text, catalog);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    onImport(result.draft, result.unknownIngredients);
    close();
  };

  return (
    <Stack component="section" aria-label="Mit KI anlegen" spacing={0.5}>
      <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", rowGap: 1 }}>
        <Button
          variant="outlined"
          size="small"
          startIcon={<ContentCopyOutlinedIcon />}
          disabled={disabled || catalog.length === 0}
          onClick={() => void copyPrompt()}
        >
          KI-Prompt kopieren
        </Button>
        <Button
          variant="outlined"
          size="small"
          startIcon={<AutoAwesomeOutlinedIcon />}
          disabled={disabled || catalog.length === 0}
          onClick={() => setOpen(true)}
        >
          JSON übernehmen
        </Button>
      </Stack>
      <Typography variant="caption" color="text.secondary">
        Prompt in einer Chat-KI einfügen, Gericht beschreiben, die JSON-Antwort hier übernehmen.
      </Typography>
      <Dialog open={open} onClose={close} fullWidth maxWidth="sm" aria-labelledby={titleId}>
        <DialogTitle id={titleId}>JSON von der KI übernehmen</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            {error && <Alert severity="error">{error}</Alert>}
            <TextField
              label="Antwort der KI"
              value={text}
              onChange={(event) => {
                setText(event.target.value);
                setError(null);
              }}
              multiline
              minRows={8}
              maxRows={16}
              fullWidth
              autoFocus
              slotProps={{ htmlInput: { spellCheck: false, style: { fontFamily: "monospace" } } }}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={close}>Abbrechen</Button>
          <Button variant="contained" onClick={apply} disabled={!text.trim()}>
            Übernehmen
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
