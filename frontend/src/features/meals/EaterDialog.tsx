/** Add or edit one eater of the family food profile (FOOD-004). Allergies are always hard rules. */

import {
  Alert,
  Autocomplete,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  MenuItem,
  Stack,
  Switch,
  TextField,
} from "@mui/material";
import { useId, useState } from "react";
import { errorMessage } from "../../api/errorMessages";
import { useActiveMembers } from "../members/api";
import { useIngredients, type Eater } from "./api";
import {
  INGREDIENT_TAGS,
  PROTEIN_LABELS,
  PROTEIN_TAGS,
  TAG_LABELS,
  type IngredientTag,
  type ProteinTag,
} from "./labels";

export const EATER_NAME_MAX = 40;
const DEFAULT_PORTION = { ADULT: 1, CHILD: 0.5 } as const;

export interface EaterDialogProps {
  /** Edit this eater; null adds a new one. */
  readonly eater: Eater | null;
  readonly pending: boolean;
  readonly error: unknown;
  readonly onSave: (eater: Eater) => void;
  readonly onClose: () => void;
}

function TagPicker<T extends string>({
  label,
  options,
  labels,
  value,
  onChange,
  helperText,
}: {
  readonly label: string;
  readonly options: readonly T[];
  readonly labels: Readonly<Record<T, string>>;
  readonly value: readonly T[];
  readonly onChange: (value: T[]) => void;
  readonly helperText?: string;
}) {
  return (
    <Autocomplete
      multiple
      options={options as T[]}
      value={value as T[]}
      onChange={(_, next) => onChange(next)}
      getOptionLabel={(option) => labels[option]}
      renderInput={(params) => <TextField {...params} label={label} helperText={helperText} />}
    />
  );
}

/** Mounted per opening (keyed by the caller), so fields start from the eater's values. */
export function EaterDialog({ eater, pending, error, onSave, onClose }: EaterDialogProps) {
  const titleId = useId();
  const members = useActiveMembers();
  const ingredients = useIngredients().data ?? [];
  const [name, setName] = useState(eater?.name ?? "");
  const [type, setType] = useState<Eater["type"]>(eater?.type ?? "ADULT");
  const [portion, setPortion] = useState(String(eater?.portionFactor ?? DEFAULT_PORTION.ADULT));
  const [vegetarian, setVegetarian] = useState(eater?.diet === "VEGETARIAN");
  const [exceptions, setExceptions] = useState<ProteinTag[]>([...(eater?.vegetarianExceptions ?? [])]);
  const [allergies, setAllergies] = useState<IngredientTag[]>([...(eater?.allergies ?? [])]);
  const [dislikeTags, setDislikeTags] = useState<IngredientTag[]>([...(eater?.dislikeTags ?? [])]);
  const [dislikeIngredients, setDislikeIngredients] = useState<string[]>([...(eater?.dislikeIngredients ?? [])]);
  const [likeIngredients, setLikeIngredients] = useState<string[]>([...(eater?.likeIngredients ?? [])]);
  const [memberId, setMemberId] = useState(eater?.memberId ?? "");

  const trimmed = name.trim();
  const portionValue = Number(portion.replace(",", "."));
  const portionValid = Number.isFinite(portionValue) && portionValue >= 0.1 && portionValue <= 2;
  const valid = trimmed !== "" && trimmed.length <= EATER_NAME_MAX && portionValid;
  const ingredientName = (id: string) => ingredients.find((ingredient) => ingredient.ingredientId === id)?.name ?? id;
  const ingredientIds = ingredients.map((ingredient) => ingredient.ingredientId);

  const changeType = (next: Eater["type"]) => {
    if (Number(portion.replace(",", ".")) === DEFAULT_PORTION[type]) setPortion(String(DEFAULT_PORTION[next]));
    setType(next);
  };

  const submit = () =>
    onSave({
      eaterId: eater?.eaterId ?? crypto.randomUUID(),
      name: trimmed,
      type,
      ...(memberId === "" ? {} : { memberId }),
      portionFactor: portionValue,
      diet: vegetarian ? "VEGETARIAN" : "OMNIVORE",
      vegetarianExceptions: vegetarian ? exceptions : [],
      allergies,
      dislikeTags,
      dislikeIngredients,
      likeIngredients,
      likeGroups: [...(eater?.likeGroups ?? [])],
    });

  const ingredientPicker = (label: string, value: string[], onChange: (next: string[]) => void) => (
    <Autocomplete
      multiple
      options={ingredientIds}
      value={value}
      onChange={(_, next) => onChange(next)}
      getOptionLabel={ingredientName}
      renderInput={(params) => <TextField {...params} label={label} />}
    />
  );

  return (
    <Dialog open onClose={pending ? undefined : onClose} aria-labelledby={titleId} fullWidth maxWidth="sm">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (valid) submit();
        }}
      >
        <DialogTitle id={titleId}>{eater ? "Person bearbeiten" : "Person hinzufügen"}</DialogTitle>
        <DialogContent>
          {error !== null && error !== undefined && (
            <Alert severity="error" sx={{ mb: 2 }}>
              Speichern fehlgeschlagen. {errorMessage(error)}
            </Alert>
          )}
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="Name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
              autoFocus
              error={trimmed.length > EATER_NAME_MAX}
              helperText={
                trimmed.length > EATER_NAME_MAX ? `Höchstens ${EATER_NAME_MAX} Zeichen.` : "Nur in der App sichtbar."
              }
            />
            <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
              <TextField
                select
                label="Alter"
                value={type}
                onChange={(event) => changeType(event.target.value as Eater["type"])}
                fullWidth
              >
                <MenuItem value="ADULT">Erwachsen</MenuItem>
                <MenuItem value="CHILD">Kind</MenuItem>
              </TextField>
              <TextField
                label="Portion"
                value={portion}
                onChange={(event) => setPortion(event.target.value)}
                slotProps={{ htmlInput: { inputMode: "decimal" } }}
                error={!portionValid}
                helperText={portionValid ? "1 = Erwachsenenportion" : "Zwischen 0,1 und 2."}
                fullWidth
              />
            </Stack>
            <TextField
              select
              label="Tenner-Mitglied (optional)"
              value={memberId}
              onChange={(event) => setMemberId(event.target.value)}
            >
              <MenuItem value="">Keins</MenuItem>
              {members.map((member) => (
                <MenuItem key={member.userId} value={member.userId}>
                  {member.displayName}
                </MenuItem>
              ))}
            </TextField>
            <FormControlLabel
              control={<Switch checked={vegetarian} onChange={(event) => setVegetarian(event.target.checked)} />}
              label="Vegetarisch"
            />
            {vegetarian && (
              <TagPicker
                label="Isst trotzdem"
                options={PROTEIN_TAGS}
                labels={PROTEIN_LABELS}
                value={exceptions}
                onChange={setExceptions}
                helperText="Z. B. Hackfleisch oder Würstchen."
              />
            )}
            <TagPicker
              label="⚠ Allergien"
              options={INGREDIENT_TAGS}
              labels={TAG_LABELS}
              value={allergies}
              onChange={setAllergies}
              helperText="Gerichte damit werden nie geplant, wenn die Person mitisst."
            />
            <TagPicker
              label="Mag nicht (Gruppen)"
              options={INGREDIENT_TAGS}
              labels={TAG_LABELS}
              value={dislikeTags}
              onChange={setDislikeTags}
            />
            {ingredientPicker("Mag nicht (Zutaten)", dislikeIngredients, setDislikeIngredients)}
            {ingredientPicker("Mag besonders (Zutaten)", likeIngredients, setLikeIngredients)}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={onClose} disabled={pending}>
            Abbrechen
          </Button>
          <Button type="submit" variant="contained" disabled={!valid || pending}>
            Speichern
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
