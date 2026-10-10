/**
 * „Gerichte“ (FOOD-010) at /essen/gerichte: the household's dishes, searchable and filterable, with the editor and
 * archive/restore (with „Rückgängig“). Archived dishes are no longer planned (FOOD-002).
 */

import AddIcon from "@mui/icons-material/Add";
import {
  Button,
  Card,
  CardActions,
  CardContent,
  Chip,
  FormControlLabel,
  MenuItem,
  Stack,
  Switch,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
  Box,
  IconButton,
} from "@mui/material";
import Grid from "@mui/material/Grid";
import { useMemo, useState } from "react";
import { Link as RouterLink, useSearchParams } from "react-router";
import { errorMessage } from "../../api/errorMessages";
import { isApiError } from "../../api/errors";
import { ErrorAlert } from "../../components/ErrorAlert";
import { SkeletonList } from "../../components/LoadingState";
import { useNotify } from "../../components/NotificationProvider";
import { PageHeader } from "../../components/PageHeader";
import { DishEditorDialog } from "./DishEditorDialog";
import { DishImage } from "./DishImage";
import { useDishHistory, useFoodProfile, type DishHistoryEntry } from "./api";
import { costLine, familyFactors, historyLine, NUTRITION_DISCLAIMER, nutritionLine } from "./format";
import {
  DISH_CATEGORIES,
  DISH_CATEGORY_LABELS,
  dishSummaryLine,
  filterDishes,
  useArchiveDish,
  useDishes,
  useToggleFavorite,
  type Dish,
  type DishFilter,
} from "./dishes";
import { TAG_LABELS, type IngredientTag } from "./labels";
import { NEW_DISH_PARAM } from "./newDish";

/** Editor state: closed, new dish, or the dish being edited. */
type Editing = { readonly dish: Dish | null } | null;

function DishCard({
  dish,
  onEdit,
  onArchive,
  costLabel,
  history,
  onToggleFavorite,
}: {
  readonly dish: Dish;
  readonly onEdit: () => void;
  readonly onArchive: () => void;
  /** FOOD-013: „€€ · ca. 8–10 €“ for the family. */
  readonly costLabel: string | null;
  /** FOOD-023: „zuletzt gegessen am …“. */
  readonly history: DishHistoryEntry | undefined;
  readonly onToggleFavorite: () => void;
}) {
  return (
    <Card sx={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <DishImage
        name={dish.name}
        category={dish.category}
        imageKey={dish.imageKey}
        height={140}
        sx={{ borderRadius: 0 }}
      />
      <CardContent sx={{ flexGrow: 1 }}>
        <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1 }}>
          <Typography variant="subtitle1" component="h2" sx={{ fontWeight: 600, flexGrow: 1 }}>
            {dish.name}
          </Typography>
          {!dish.archived && (
            <IconButton
              size="small"
              aria-label={`${dish.name} als Favorit`}
              aria-pressed={dish.favorite}
              onClick={onToggleFavorite}
              sx={{ mt: -0.5, mr: -0.5, opacity: dish.favorite ? 1 : 0.4 }}
            >
              <span aria-hidden="true">⭐</span>
            </IconButton>
          )}
        </Box>
        <Typography variant="body2" color="text.secondary">
          {DISH_CATEGORY_LABELS[dish.category]}
          {dish.group ? ` · ${dish.group}` : ""}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {dishSummaryLine(dish)}
        </Typography>
        {history && (
          <Typography variant="body2" color="text.secondary">
            {historyLine(history)}
          </Typography>
        )}
        {costLabel && (
          <Typography variant="body2" color="text.secondary" title="Grobe Schätzung für die ganze Familie">
            {costLabel}
          </Typography>
        )}
        {dish.nutrition && (
          <Typography variant="body2" color="text.secondary" title={NUTRITION_DISCLAIMER}>
            {nutritionLine(dish.nutrition)}
          </Typography>
        )}
        <Stack direction="row" sx={{ flexWrap: "wrap", gap: 0.5, mt: 1 }}>
          {(dish.isVegetarian || dish.vegetarianVariant) && (
            <Chip size="small" color="success" label={dish.isVegetarian ? "vegetarisch" : "vegetarische Variante"} />
          )}
          {dish.tags
            .filter((tag) => !["MEAT", "POULTRY", "PORK", "BEEF", "FISH"].includes(tag) || !dish.isVegetarian)
            .slice(0, 5)
            .map((tag) => (
              <Chip key={tag} size="small" variant="outlined" label={TAG_LABELS[tag as IngredientTag] ?? tag} />
            ))}
          {dish.unknownIngredients.length > 0 && <Chip size="small" color="warning" label="Zutat fehlt" />}
        </Stack>
      </CardContent>
      <CardActions>
        {!dish.archived && (
          <Button size="small" onClick={onEdit} aria-label={`${dish.name} bearbeiten`}>
            Bearbeiten
          </Button>
        )}
        <Button
          size="small"
          color={dish.archived ? "primary" : "inherit"}
          onClick={onArchive}
          aria-label={`${dish.name} ${dish.archived ? "wiederherstellen" : "archivieren"}`}
        >
          {dish.archived ? "Wiederherstellen" : "Archivieren"}
        </Button>
      </CardActions>
    </Card>
  );
}

export function DishesPage() {
  const notify = useNotify();
  const [archived, setArchived] = useState(false);
  const dishes = useDishes(archived);
  const active = useDishes(false);
  const archive = useArchiveDish();
  const [editing, setEditing] = useState<Editing>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  // The plus button opens /essen/gerichte?new=1 (MAINT-008): the editor for a new dish is open while the parameter is
  // there; closing the editor drops it, so „Zurück“ does not open it again.
  const shownEditing: Editing = editing ?? (searchParams.has(NEW_DISH_PARAM) ? { dish: null } : null);
  const closeEditor = () => {
    setEditing(null);
    if (searchParams.has(NEW_DISH_PARAM)) {
      setSearchParams(
        (params) => {
          params.delete(NEW_DISH_PARAM);
          return params;
        },
        { replace: true },
      );
    }
  };
  const [filter, setFilter] = useState<DishFilter>({ search: "", slot: "ALL", vegetarianOnly: false, category: "ALL" });

  const shown = useMemo(() => filterDishes(dishes.data ?? [], filter), [dishes.data, filter]);
  const profile = useFoodProfile().data;
  const history = useDishHistory();
  const favorite = useToggleFavorite();
  const factors = familyFactors(profile?.eaters);
  const tiers = profile?.household.costTiers ?? { cheapMax: 6, mediumMax: 10 };
  const groups = useMemo(
    () =>
      [...new Set((active.data ?? []).flatMap((dish) => (dish.group ? [dish.group] : [])))].sort((a, b) =>
        a.localeCompare(b, "de"),
      ),
    [active.data],
  );

  const toggleArchived = (dish: Dish, undo = false) => {
    const target = !dish.archived;
    archive.mutate(
      { dishId: dish.dishId, archived: target },
      {
        onSuccess: (changed) => {
          if (undo) return;
          notify({
            message: target
              ? `„${changed.name}“ archiviert. Es wird nicht mehr geplant.`
              : `„${changed.name}“ wiederhergestellt.`,
            action: { label: "Rückgängig", onClick: () => toggleArchived(changed, true) },
            durationMs: 10_000,
          });
        },
        onError: (error) =>
          notify({
            severity: "error",
            message:
              isApiError(error) && error.code === "DISH_NAME_TAKEN"
                ? `Es gibt schon ein aktives Gericht „${dish.name}“.`
                : `Nicht geändert. ${errorMessage(error)}`,
          }),
      },
    );
  };

  return (
    <>
      <PageHeader
        title="Gerichte"
        subtitle={dishes.data ? `${dishes.data.length} ${archived ? "archiviert" : "Gerichte"}` : undefined}
        actions={
          <Stack direction="row" spacing={1}>
            <Button component={RouterLink} to="/essen" size="small">
              Zum Essensplan
            </Button>
            <Button variant="contained" size="small" startIcon={<AddIcon />} onClick={() => setEditing({ dish: null })}>
              Neues Gericht
            </Button>
          </Stack>
        }
      />
      <Stack
        direction={{ xs: "column", md: "row" }}
        spacing={2}
        sx={{ mb: 3, alignItems: { md: "center" }, flexWrap: "wrap", rowGap: 2 }}
      >
        <TextField
          label="Suchen"
          size="small"
          value={filter.search}
          onChange={(event) => setFilter({ ...filter, search: event.target.value })}
          sx={{ minWidth: 220 }}
        />
        <ToggleButtonGroup
          exclusive
          size="small"
          value={filter.slot}
          onChange={(_event, value: DishFilter["slot"] | null) => value && setFilter({ ...filter, slot: value })}
          aria-label="Mahlzeit"
        >
          <ToggleButton value="ALL">Alle</ToggleButton>
          <ToggleButton value="LUNCH">Mittag</ToggleButton>
          <ToggleButton value="DINNER">Abend</ToggleButton>
        </ToggleButtonGroup>
        <TextField
          select
          label="Kategorie"
          size="small"
          value={filter.category}
          onChange={(event) => setFilter({ ...filter, category: event.target.value as DishFilter["category"] })}
          sx={{ minWidth: 180 }}
        >
          <MenuItem value="ALL">Alle Kategorien</MenuItem>
          {DISH_CATEGORIES.map((category) => (
            <MenuItem key={category} value={category}>
              {DISH_CATEGORY_LABELS[category]}
            </MenuItem>
          ))}
        </TextField>
        <FormControlLabel
          label="Vegetarisch"
          control={
            <Switch
              checked={filter.vegetarianOnly}
              onChange={(event) => setFilter({ ...filter, vegetarianOnly: event.target.checked })}
            />
          }
        />
        <FormControlLabel
          label="Archivierte zeigen"
          control={<Switch checked={archived} onChange={(event) => setArchived(event.target.checked)} />}
        />
      </Stack>
      {dishes.isPending ? (
        <SkeletonList count={4} label="Gerichte werden geladen" />
      ) : dishes.isError ? (
        <ErrorAlert
          title="Gerichte konnten nicht geladen werden"
          message={errorMessage(dishes.error)}
          onRetry={() => void dishes.refetch()}
        />
      ) : shown.length === 0 ? (
        <Typography color="text.secondary">
          {(dishes.data ?? []).length === 0
            ? archived
              ? "Keine archivierten Gerichte."
              : "Noch keine Gerichte. Legt das erste an oder importiert den Gerichtekatalog in den Einstellungen."
            : "Kein Gericht passt zu den Filtern."}
        </Typography>
      ) : (
        <Grid container spacing={2} component="ul" sx={{ p: 0, m: 0 }} aria-label="Gerichte">
          {shown.map((dish) => (
            <Grid key={dish.dishId} component="li" size={{ xs: 12, sm: 6, lg: 4 }} sx={{ listStyle: "none" }}>
              <DishCard
                dish={dish}
                onEdit={() => setEditing({ dish })}
                onArchive={() => toggleArchived(dish)}
                costLabel={dish.cost ? costLine(dish.cost, factors, tiers) : null}
                history={history.data?.get(dish.dishId)}
                onToggleFavorite={() =>
                  favorite.mutate(
                    { dishId: dish.dishId, favorite: !dish.favorite },
                    {
                      onError: (error) =>
                        notify({ severity: "error", message: `Nicht gespeichert. ${errorMessage(error)}` }),
                    },
                  )
                }
              />
            </Grid>
          ))}
        </Grid>
      )}
      {shownEditing && (
        <DishEditorDialog
          key={shownEditing.dish?.dishId ?? "new"}
          dish={shownEditing.dish}
          groups={groups}
          onClose={closeEditor}
        />
      )}
    </>
  );
}
