/**
 * „Gericht anlegen / bearbeiten“ (FOOD-010): all dish fields, ingredients from the catalog (with „Neue Zutat“),
 * and live what the dish means for the family — vegetarian, allergens, protein and base, and which rules and eaters
 * it affects (FOOD-005).
 */

import DeleteOutlinedIcon from "@mui/icons-material/DeleteOutlined";
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Checkbox,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  FormGroup,
  FormHelperText,
  IconButton,
  MenuItem,
  Stack,
  Switch,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import { useEffect, useId, useMemo, useState } from "react";
import { errorMessage } from "../../api/errorMessages";
import { isApiError } from "../../api/errors";
import { useNotify } from "../../components/NotificationProvider";
import { useFoodProfile, useIngredients, type Ingredient } from "./api";
import {
  BASE_TAG_LABELS,
  DISH_CATEGORIES,
  DISH_CATEGORY_LABELS,
  deriveDraft,
  ruleHints,
  unitsFor,
  useSaveDish,
  validateDraft,
  type BaseTag,
  type Dish,
  type DishCategory,
  type DishIngredient,
  type DishInput,
  type DraftErrors,
} from "./dishes";
import {
  MEAL_SLOT_LABELS,
  PROTEIN_LABELS,
  TAG_LABELS,
  type IngredientTag,
  type MealSlot,
  type ProteinTag,
} from "./labels";
import { DishImage } from "./DishImage";
import { NUTRITION_DISCLAIMER, nutritionLine } from "./format";
import { PhotoError, resizePhoto, useDishPhoto, type PhotoChange } from "./dishImages";
import { NewIngredientDialog } from "./NewIngredientDialog";

const NEW_INGREDIENT = "__new__";

const NUTRITION_FIELDS = [
  ["kcal", "kcal"],
  ["protein", "Eiweiß (g)"],
  ["carbs", "Kohlenhydrate (g)"],
  ["fat", "Fett (g)"],
] as const;

/** Empty input → NaN, so validation reports it instead of saving 0. */
const parseNumber = (value: string): number => (value.trim() === "" ? Number.NaN : Number(value));

function initialDraft(dish: Dish | null): DishInput {
  if (!dish) {
    return {
      name: "",
      group: null,
      category: "PASTA",
      slots: ["LUNCH", "DINNER"],
      lightness: "FILLING",
      temperature: "WARM",
      ingredients: [],
      activeMinutes: 20,
      totalMinutes: 20,
      vegetarianVariant: null,
      familyFriendly: true,
      isBurger: false,
      nutritionOverride: null,
    };
  }
  return {
    name: dish.name,
    group: dish.group ?? null,
    category: dish.category,
    slots: [...dish.slots],
    lightness: dish.lightness,
    temperature: dish.temperature,
    ingredients: dish.ingredients.map((entry) => ({ ...entry })),
    activeMinutes: dish.activeMinutes,
    totalMinutes: dish.totalMinutes,
    vegetarianVariant: dish.vegetarianVariant ?? null,
    familyFriendly: dish.familyFriendly,
    isBurger: dish.isBurger,
    nutritionOverride: dish.nutritionOverride ?? null,
  };
}

/** Server field errors (VALIDATION_ERROR details, DISH_NAME_TAKEN) onto the form; null when it is another error. */
function serverErrors(error: unknown): DraftErrors | null {
  if (!isApiError(error)) return null;
  if (error.code === "DISH_NAME_TAKEN") return { name: "Ein Gericht mit diesem Namen gibt es schon." };
  if (error.code !== "VALIDATION_ERROR" || error.details.length === 0) return null;
  return Object.fromEntries(error.details.map((detail) => [detail.field, detail.message]));
}

export interface DishEditorDialogProps {
  /** null = new dish. */
  readonly dish: Dish | null;
  /** Existing groups for suggestions. */
  readonly groups: readonly string[];
  readonly onClose: () => void;
}

export function DishEditorDialog({ dish, groups, onClose }: DishEditorDialogProps) {
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down("sm"));
  const titleId = useId();
  const notify = useNotify();
  const save = useSaveDish();
  const catalog = useIngredients();
  const profile = useFoodProfile();
  const [draft, setDraft] = useState<DishInput>(() => initialDraft(dish));
  const [errors, setErrors] = useState<DraftErrors>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [newIngredient, setNewIngredient] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const photo = useDishPhoto();
  const [photoChange, setPhotoChange] = useState<PhotoChange | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [preparingPhoto, setPreparingPhoto] = useState(false);
  const previewUrl = useMemo(
    () => (photoChange?.kind === "new" ? URL.createObjectURL(photoChange.photo) : undefined),
    [photoChange],
  );
  useEffect(() => () => (previewUrl ? URL.revokeObjectURL(previewUrl) : undefined), [previewUrl]);
  const busy = save.isPending || photo.isPending || preparingPhoto;

  const pickPhoto = async (file: File | undefined) => {
    if (!file) return;
    setPhotoError(null);
    setPreparingPhoto(true);
    try {
      setPhotoChange({ kind: "new", photo: await resizePhoto(file) });
    } catch (error) {
      setPhotoError(error instanceof PhotoError ? error.message : "Das Foto konnte nicht verarbeitet werden.");
    } finally {
      setPreparingPhoto(false);
    }
  };

  const ingredients = useMemo(() => catalog.data ?? [], [catalog.data]);
  const byId = useMemo(
    () => new Map(ingredients.map((ingredient) => [ingredient.ingredientId, ingredient])),
    [ingredients],
  );
  const derived = useMemo(() => deriveDraft(draft.ingredients, ingredients), [draft.ingredients, ingredients]);
  const hints = useMemo(() => ruleHints(draft, derived, profile.data), [draft, derived, profile.data]);

  const update = (changes: Partial<DishInput>) => setDraft((current) => ({ ...current, ...changes }));
  const updateEntry = (index: number, changes: Partial<DishIngredient>) =>
    update({
      ingredients: draft.ingredients.map((entry, position) => (position === index ? { ...entry, ...changes } : entry)),
    });
  const addIngredient = (ingredient: Pick<Ingredient, "ingredientId" | "unit">) => {
    if (draft.ingredients.some((entry) => entry.ingredientId === ingredient.ingredientId)) return;
    const quantity = ingredient.unit === "Stück" ? 1 : 100;
    update({
      ingredients: [
        ...draft.ingredients,
        { ingredientId: ingredient.ingredientId, quantity, unit: ingredient.unit, optional: false },
      ],
    });
  };

  const submit = () => {
    const input: DishInput = {
      ...draft,
      name: draft.name.trim(),
      group: draft.group?.trim() ? draft.group.trim() : null,
      vegetarianVariant: draft.vegetarianVariant?.trim() ? draft.vegetarianVariant.trim() : null,
    };
    const found = validateDraft(input);
    setErrors(found);
    setFailure(null);
    if (Object.keys(found).length > 0) return;
    save.mutate(
      { dishId: dish?.dishId ?? null, input },
      {
        onSuccess: (saved) => {
          const done = () => {
            notify({ message: dish ? `✅ „${saved.name}“ gespeichert.` : `✅ „${saved.name}“ angelegt.` });
            onClose();
          };
          if (!photoChange) return done();
          photo.mutate(
            { dishId: saved.dishId, change: photoChange },
            {
              onSuccess: done,
              onError: (error) => {
                notify({
                  severity: "error",
                  message: `„${saved.name}“ gespeichert, aber das Foto nicht. ${error instanceof PhotoError ? error.message : errorMessage(error)}`,
                });
                onClose();
              },
            },
          );
        },
        onError: (error) => {
          const fields = serverErrors(error);
          if (fields) setErrors(fields);
          else if (isApiError(error) && error.code === "CONCURRENT_MODIFICATION") {
            setFailure(
              "Das Gericht wurde gerade an einem anderen Gerät geändert. Schließe den Dialog und öffne es neu.",
            );
          } else setFailure(errorMessage(error));
        },
      },
    );
  };

  const available = ingredients.filter(
    (ingredient) => !draft.ingredients.some((entry) => entry.ingredientId === ingredient.ingredientId),
  );
  const options: (Ingredient | typeof NEW_INGREDIENT)[] = [...available, NEW_INGREDIENT];

  return (
    <Dialog
      open
      onClose={busy ? undefined : onClose}
      fullScreen={fullScreen}
      fullWidth
      maxWidth="md"
      aria-labelledby={titleId}
    >
      <DialogTitle id={titleId}>{dish ? "Gericht bearbeiten" : "Gericht anlegen"}</DialogTitle>
      <DialogContent>
        <Stack spacing={2.5} sx={{ mt: 1 }}>
          {failure && <Alert severity="error">{failure}</Alert>}
          <Box
            component="section"
            aria-label="Foto"
            sx={{ display: "flex", gap: 2, alignItems: "center", flexWrap: "wrap" }}
          >
            <DishImage
              name={draft.name || "Neues Gericht"}
              category={draft.category}
              imageKey={photoChange?.kind === "remove" ? undefined : dish?.imageKey}
              previewUrl={previewUrl}
              width={120}
              height={90}
            />
            <Stack spacing={0.5} sx={{ alignItems: "flex-start" }}>
              <Button component="label" variant="outlined" size="small" disabled={busy}>
                {preparingPhoto ? "Foto wird vorbereitet …" : "Foto aufnehmen / auswählen"}
                <input
                  hidden
                  type="file"
                  accept="image/*"
                  capture="environment"
                  aria-label="Foto aufnehmen oder auswählen"
                  onChange={(event) => {
                    void pickPhoto(event.target.files?.[0]);
                    event.target.value = "";
                  }}
                />
              </Button>
              {(photoChange?.kind === "new" || (dish?.imageKey !== undefined && photoChange?.kind !== "remove")) && (
                <Button
                  size="small"
                  color="inherit"
                  disabled={busy}
                  onClick={() => setPhotoChange(dish?.imageKey ? { kind: "remove" } : null)}
                >
                  Foto entfernen
                </Button>
              )}
              <Typography variant="caption" color="text.secondary">
                Bitte nur das Essen fotografieren, keine Personen.
              </Typography>
              {photoError && <FormHelperText error>{photoError}</FormHelperText>}
            </Stack>
          </Box>
          <TextField
            label="Name"
            required
            value={draft.name}
            onChange={(event) => update({ name: event.target.value })}
            error={errors.name !== undefined}
            helperText={errors.name}
          />
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <Autocomplete
              freeSolo
              options={[...groups]}
              value={draft.group ?? ""}
              onInputChange={(_event, value) => update({ group: value })}
              sx={{ flex: 1 }}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Gruppe (optional)"
                  error={errors.group !== undefined}
                  helperText={errors.group ?? "Varianten einer Gruppe gibt es höchstens einmal pro Woche."}
                />
              )}
            />
            <TextField
              select
              label="Kategorie"
              value={draft.category}
              onChange={(event) => update({ category: event.target.value as DishCategory })}
              sx={{ minWidth: 200 }}
            >
              {DISH_CATEGORIES.map((category) => (
                <MenuItem key={category} value={category}>
                  {DISH_CATEGORY_LABELS[category]}
                </MenuItem>
              ))}
            </TextField>
          </Stack>
          <Box>
            <FormGroup row aria-label="Mahlzeit">
              {(["LUNCH", "DINNER"] as MealSlot[]).map((slot) => (
                <FormControlLabel
                  key={slot}
                  label={MEAL_SLOT_LABELS[slot]}
                  control={
                    <Checkbox
                      checked={draft.slots.includes(slot)}
                      onChange={(event) =>
                        update({
                          slots: event.target.checked
                            ? (["LUNCH", "DINNER"] as MealSlot[]).filter(
                                (entry) => entry === slot || draft.slots.includes(entry),
                              )
                            : draft.slots.filter((entry) => entry !== slot),
                        })
                      }
                    />
                  }
                />
              ))}
            </FormGroup>
            {errors.slots && <FormHelperText error>{errors.slots}</FormHelperText>}
          </Box>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <ToggleButtonGroup
              exclusive
              size="small"
              value={draft.lightness}
              onChange={(_event, value: DishInput["lightness"] | null) => value && update({ lightness: value })}
              aria-label="Leicht oder sättigend"
            >
              <ToggleButton value="LIGHT">Leicht</ToggleButton>
              <ToggleButton value="FILLING">Sättigend</ToggleButton>
            </ToggleButtonGroup>
            <ToggleButtonGroup
              exclusive
              size="small"
              value={draft.temperature}
              onChange={(_event, value: DishInput["temperature"] | null) => value && update({ temperature: value })}
              aria-label="Warm oder kalt"
            >
              <ToggleButton value="WARM">Warm</ToggleButton>
              <ToggleButton value="COLD">Kalt</ToggleButton>
            </ToggleButtonGroup>
          </Stack>

          <Box component="section" aria-label="Zutaten">
            <Typography variant="subtitle2" component="h3" sx={{ mb: 1 }}>
              Zutaten pro erwachsener Portion
            </Typography>
            <Stack spacing={1}>
              {draft.ingredients.map((entry, index) => {
                const ingredient = byId.get(entry.ingredientId);
                const name = ingredient?.name ?? entry.ingredientId;
                return (
                  <Stack
                    key={entry.ingredientId}
                    direction="row"
                    spacing={1}
                    sx={{ alignItems: "center", flexWrap: "wrap", rowGap: 1 }}
                  >
                    <Typography sx={{ flex: "1 1 160px" }}>{name}</Typography>
                    <TextField
                      label="Menge"
                      type="number"
                      size="small"
                      value={Number.isNaN(entry.quantity) ? "" : entry.quantity}
                      onChange={(event) => updateEntry(index, { quantity: parseNumber(event.target.value) })}
                      error={errors[`ingredients.${index}.quantity`] !== undefined}
                      helperText={errors[`ingredients.${index}.quantity`]}
                      slotProps={{ htmlInput: { min: 0, step: "any", "aria-label": `Menge ${name}` } }}
                      sx={{ width: 110 }}
                    />
                    <TextField
                      select
                      size="small"
                      value={entry.unit}
                      onChange={(event) => updateEntry(index, { unit: event.target.value as DishIngredient["unit"] })}
                      slotProps={{ htmlInput: { "aria-label": `Einheit ${name}` } }}
                      sx={{ width: 100 }}
                    >
                      {(ingredient ? unitsFor(ingredient) : [entry.unit]).map((unit) => (
                        <MenuItem key={unit} value={unit}>
                          {unit}
                        </MenuItem>
                      ))}
                    </TextField>
                    <FormControlLabel
                      label="optional"
                      control={
                        <Switch
                          size="small"
                          checked={entry.optional}
                          onChange={(event) => updateEntry(index, { optional: event.target.checked })}
                        />
                      }
                    />
                    <IconButton
                      aria-label={`${name} entfernen`}
                      onClick={() =>
                        update({ ingredients: draft.ingredients.filter((_, position) => position !== index) })
                      }
                    >
                      <DeleteOutlinedIcon />
                    </IconButton>
                  </Stack>
                );
              })}
            </Stack>
            <Autocomplete
              options={options}
              value={null}
              inputValue={search}
              onInputChange={(_event, value, reason) => reason !== "reset" && setSearch(value)}
              getOptionLabel={(option) =>
                option === NEW_INGREDIENT ? `Neue Zutat „${search.trim()}“ anlegen` : option.name
              }
              filterOptions={(list, state) => {
                const query = state.inputValue.trim().toLocaleLowerCase("de");
                return list
                  .filter((option) => option === NEW_INGREDIENT || option.name.toLocaleLowerCase("de").includes(query))
                  .slice(0, 30);
              }}
              onChange={(_event, option) => {
                if (option === null) return;
                if (option === NEW_INGREDIENT) setNewIngredient(search.trim());
                else addIngredient(option);
                setSearch("");
              }}
              loading={catalog.isPending}
              sx={{ mt: 1.5 }}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Zutat hinzufügen"
                  error={errors.ingredients !== undefined}
                  helperText={errors.ingredients}
                />
              )}
            />
          </Box>

          <Stack direction="row" spacing={2}>
            <TextField
              label="Aktive Kochzeit (Min.)"
              type="number"
              value={Number.isNaN(draft.activeMinutes) ? "" : draft.activeMinutes}
              onChange={(event) => {
                const activeMinutes = parseNumber(event.target.value);
                update({
                  activeMinutes,
                  ...(draft.totalMinutes === draft.activeMinutes ? { totalMinutes: activeMinutes } : {}),
                });
              }}
              error={errors.activeMinutes !== undefined}
              helperText={errors.activeMinutes ?? "Zeit, in der jemand am Herd steht."}
              slotProps={{ htmlInput: { min: 1, inputMode: "numeric" } }}
            />
            <TextField
              label="Gesamtzeit (Min.)"
              type="number"
              value={Number.isNaN(draft.totalMinutes) ? "" : draft.totalMinutes}
              onChange={(event) => update({ totalMinutes: parseNumber(event.target.value) })}
              error={errors.totalMinutes !== undefined}
              helperText={errors.totalMinutes ?? "Mit Backofen- und Kochzeit."}
              slotProps={{ htmlInput: { min: 1, inputMode: "numeric" } }}
            />
          </Stack>
          <TextField
            label="Vegetarische Variante (optional)"
            value={draft.vegetarianVariant ?? ""}
            onChange={(event) => update({ vegetarianVariant: event.target.value })}
            error={errors.vegetarianVariant !== undefined}
            helperText={
              errors.vegetarianVariant ?? "Zum Beispiel „mit Veggie-Patty“. Dann passt das Gericht auch für Vegetarier."
            }
          />
          <FormGroup row>
            <FormControlLabel
              label="Familientauglich"
              control={
                <Switch
                  checked={draft.familyFriendly}
                  onChange={(event) => update({ familyFriendly: event.target.checked })}
                />
              }
            />
            <FormControlLabel
              label="Burger"
              control={
                <Switch checked={draft.isBurger} onChange={(event) => update({ isBurger: event.target.checked })} />
              }
            />
            <FormControlLabel
              label="Nährwerte selbst eintragen"
              control={
                <Switch
                  checked={draft.nutritionOverride !== null}
                  onChange={(event) =>
                    update({
                      nutritionOverride: event.target.checked
                        ? ((dish?.nutrition && {
                            kcal: dish.nutrition.kcal,
                            protein: dish.nutrition.protein,
                            carbs: dish.nutrition.carbs,
                            fat: dish.nutrition.fat,
                          }) ?? { kcal: 500, protein: 20, carbs: 60, fat: 15 })
                        : null,
                    })
                  }
                />
              }
            />
          </FormGroup>
          {draft.nutritionOverride && (
            <Stack
              direction="row"
              spacing={1}
              sx={{ flexWrap: "wrap", rowGap: 1 }}
              role="group"
              aria-label="Nährwerte pro Erwachsenenportion"
            >
              {NUTRITION_FIELDS.map(([field, label]) => (
                <TextField
                  key={field}
                  label={label}
                  type="number"
                  size="small"
                  value={
                    draft.nutritionOverride && !Number.isNaN(draft.nutritionOverride[field])
                      ? draft.nutritionOverride[field]
                      : ""
                  }
                  onChange={(event) =>
                    draft.nutritionOverride &&
                    update({
                      nutritionOverride: { ...draft.nutritionOverride, [field]: parseNumber(event.target.value) },
                    })
                  }
                  error={errors[`nutritionOverride.${field}`] !== undefined}
                  helperText={errors[`nutritionOverride.${field}`]}
                  slotProps={{ htmlInput: { min: 0, inputMode: "numeric" } }}
                  sx={{ width: 130 }}
                />
              ))}
            </Stack>
          )}

          <Box
            component="section"
            aria-label="Was das Gericht bedeutet"
            sx={{ p: 2, borderRadius: 1, bgcolor: "action.hover" }}
          >
            <Typography variant="subtitle2" component="h3" sx={{ mb: 1 }}>
              Was das Gericht bedeutet
            </Typography>
            <Stack direction="row" sx={{ flexWrap: "wrap", gap: 1, mb: hints.length > 0 ? 1.5 : 0 }}>
              <Chip
                size="small"
                color={derived.isVegetarian ? "success" : "default"}
                label={
                  derived.isVegetarian
                    ? "vegetarisch"
                    : draft.vegetarianVariant
                      ? "vegetarische Variante"
                      : "nicht vegetarisch"
                }
              />
              {derived.proteinSources.map((source) => (
                <Chip
                  key={source}
                  size="small"
                  variant="outlined"
                  label={`Protein: ${PROTEIN_LABELS[source as ProteinTag] ?? source}`}
                />
              ))}
              {derived.baseTags.map((base) => (
                <Chip
                  key={base}
                  size="small"
                  variant="outlined"
                  label={`Grundzutat: ${BASE_TAG_LABELS[base as BaseTag] ?? base}`}
                />
              ))}
              {derived.tags.map((tag) => (
                <Chip key={tag} size="small" variant="outlined" label={TAG_LABELS[tag as IngredientTag] ?? tag} />
              ))}
              {derived.optionalTags.map((tag) => (
                <Chip
                  key={tag}
                  size="small"
                  variant="outlined"
                  label={`optional: ${TAG_LABELS[tag as IngredientTag] ?? tag}`}
                />
              ))}
            </Stack>
            {dish?.nutrition && (
              <Typography variant="body2" sx={{ mb: 1 }}>
                {nutritionLine(dish.nutrition)} pro Erwachsenenportion
                <Typography component="span" variant="caption" color="text.secondary" sx={{ display: "block" }}>
                  {NUTRITION_DISCLAIMER} Stand beim letzten Speichern
                  {dish.nutrition.source === "OVERRIDE" ? " (von Hand eingetragen)" : ""}.
                </Typography>
              </Typography>
            )}
            <Stack spacing={1}>
              {hints.map((hint) => (
                <Alert key={hint.text} severity={hint.severity} variant="outlined" sx={{ py: 0 }}>
                  {hint.text}
                </Alert>
              ))}
            </Stack>
          </Box>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={busy}>
          Abbrechen
        </Button>
        <Button variant="contained" onClick={submit} disabled={busy}>
          {dish ? "Speichern" : "Gericht anlegen"}
        </Button>
      </DialogActions>
      {newIngredient !== null && (
        <NewIngredientDialog
          open
          initialName={newIngredient}
          onClose={() => setNewIngredient(null)}
          onCreated={(ingredient) => {
            addIngredient(ingredient);
            setNewIngredient(null);
          }}
        />
      )}
    </Dialog>
  );
}
