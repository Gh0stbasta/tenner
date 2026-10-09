/** „Neue Zutat“ from the dish editor (FOOD-010 → FOOD-021): a household ingredient with the fields a dish needs. */

import {
  Alert,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { useId, useState } from "react";
import { errorMessage } from "../../api/errorMessages";
import type { Ingredient } from "./api";
import { useCreateIngredient, type NewIngredientInput } from "./dishes";
import { INGREDIENT_TAGS, TAG_LABELS, type IngredientTag } from "./labels";
import { SHOPPING_SECTION_LABELS } from "./shopping";

export interface NewIngredientDialogProps {
  readonly open: boolean;
  /** Prefilled from what was typed into the ingredient search. */
  readonly initialName: string;
  readonly onClose: () => void;
  readonly onCreated: (ingredient: Pick<Ingredient, "ingredientId" | "name" | "unit">) => void;
}

export function NewIngredientDialog({ open, initialName, onClose, onCreated }: NewIngredientDialogProps) {
  const titleId = useId();
  const create = useCreateIngredient();
  const [name, setName] = useState(initialName);
  const [unit, setUnit] = useState<NewIngredientInput["unit"]>("g");
  const [gramsPerPiece, setGramsPerPiece] = useState("");
  const [tags, setTags] = useState<IngredientTag[]>([]);
  const [section, setSection] = useState("SONSTIGES");
  const nameError = name.trim().length < 2 ? "Bitte mindestens 2 Zeichen." : undefined;
  const pieceError =
    unit === "Stück" && !(Number(gramsPerPiece) > 0) ? "Gewicht pro Stück in Gramm angeben." : undefined;

  const toggle = (tag: IngredientTag) =>
    setTags((current) => (current.includes(tag) ? current.filter((entry) => entry !== tag) : [...current, tag]));

  const save = () => {
    create.mutate(
      {
        name: name.trim(),
        unit,
        tags,
        shoppingSection: section,
        ...(unit === "Stück" ? { gramsPerPiece: Number(gramsPerPiece) } : {}),
      },
      {
        onSuccess: (created) => {
          onCreated({ ingredientId: created.ingredientId, name: created.name, unit: created.unit });
          create.reset();
        },
      },
    );
  };

  return (
    <Dialog
      open={open}
      onClose={create.isPending ? undefined : onClose}
      fullWidth
      maxWidth="sm"
      aria-labelledby={titleId}
    >
      <DialogTitle id={titleId}>Neue Zutat</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          {create.isError && <Alert severity="error">{errorMessage(create.error)}</Alert>}
          <TextField
            label="Name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
            error={nameError !== undefined}
            helperText={nameError}
          />
          <Stack direction="row" spacing={2}>
            <TextField
              select
              label="Einheit"
              value={unit}
              onChange={(event) => setUnit(event.target.value as NewIngredientInput["unit"])}
              sx={{ minWidth: 140 }}
            >
              <MenuItem value="g">Gramm</MenuItem>
              <MenuItem value="ml">Milliliter</MenuItem>
              <MenuItem value="Stück">Stück</MenuItem>
            </TextField>
            {unit === "Stück" && (
              <TextField
                label="Gramm pro Stück"
                type="number"
                value={gramsPerPiece}
                onChange={(event) => setGramsPerPiece(event.target.value)}
                error={pieceError !== undefined}
                helperText={pieceError}
                slotProps={{ htmlInput: { min: 1, inputMode: "numeric" } }}
              />
            )}
          </Stack>
          <TextField
            select
            label="Bereich im Laden"
            value={section}
            onChange={(event) => setSection(event.target.value)}
          >
            {Object.entries(SHOPPING_SECTION_LABELS).map(([value, label]) => (
              <MenuItem key={value} value={value}>
                {label}
              </MenuItem>
            ))}
          </TextField>
          <div>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              Enthält (für Allergien, vegetarisch und Abneigungen)
            </Typography>
            <Stack direction="row" sx={{ flexWrap: "wrap", gap: 1 }} role="group" aria-label="Enthält">
              {INGREDIENT_TAGS.map((tag) => (
                <Chip
                  key={tag}
                  label={TAG_LABELS[tag]}
                  color={tags.includes(tag) ? "primary" : "default"}
                  variant={tags.includes(tag) ? "filled" : "outlined"}
                  onClick={() => toggle(tag)}
                  aria-pressed={tags.includes(tag)}
                />
              ))}
            </Stack>
          </div>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={create.isPending}>
          Abbrechen
        </Button>
        <Button
          variant="contained"
          onClick={save}
          disabled={create.isPending || nameError !== undefined || pieceError !== undefined}
        >
          Zutat anlegen
        </Button>
      </DialogActions>
    </Dialog>
  );
}
