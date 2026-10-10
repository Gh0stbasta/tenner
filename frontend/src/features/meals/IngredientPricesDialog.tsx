/**
 * „Preise“ (FOOD-013): the household corrects ingredient prices when supermarket prices change. Catalog ingredients
 * keep the new price as a household override; dish and week costs follow on the next read.
 */

import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  InputAdornment,
  List,
  ListItem,
  ListItemText,
  TextField,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import { useId, useMemo, useState } from "react";
import { errorMessage } from "../../api/errorMessages";
import { useNotify } from "../../components/NotificationProvider";
import { useIngredients, useUpdateIngredientPrice, type Ingredient } from "./api";
import { formatEuro } from "./format";

const unitLabel = (unit: Ingredient["unit"]): string => (unit === "Stück" ? "pro Stück" : `pro 100 ${unit}`);

function PriceRow({ ingredient }: { readonly ingredient: Ingredient }) {
  const notify = useNotify();
  const update = useUpdateIngredientPrice();
  const [value, setValue] = useState(String(ingredient.pricePerUnit).replace(".", ","));
  const parsed = Number(value.replace(",", "."));
  const valid = value.trim() !== "" && Number.isFinite(parsed) && parsed >= 0 && parsed <= 100;
  const changed = valid && Math.abs(parsed - ingredient.pricePerUnit) > 0.0001;

  const save = () =>
    update.mutate(
      { ingredientId: ingredient.ingredientId, pricePerUnit: Math.round(parsed * 100) / 100 },
      {
        onSuccess: () =>
          notify({ message: `Preis für „${ingredient.name}“: ${formatEuro(parsed)} ${unitLabel(ingredient.unit)}.` }),
        onError: (error) => notify({ severity: "error", message: `Preis nicht gespeichert. ${errorMessage(error)}` }),
      },
    );

  return (
    <ListItem disableGutters sx={{ gap: 1, flexWrap: "wrap" }}>
      <ListItemText primary={ingredient.name} secondary={unitLabel(ingredient.unit)} sx={{ minWidth: 160 }} />
      <TextField
        size="small"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        error={!valid}
        helperText={valid ? undefined : "0 bis 100 €"}
        slotProps={{
          htmlInput: { inputMode: "decimal", "aria-label": `Preis ${ingredient.name}` },
          input: { endAdornment: <InputAdornment position="end">€</InputAdornment> },
        }}
        sx={{ width: 120 }}
      />
      <Button
        size="small"
        onClick={save}
        disabled={!changed || update.isPending}
        aria-label={`Preis ${ingredient.name} speichern`}
      >
        Speichern
      </Button>
    </ListItem>
  );
}

export function IngredientPricesDialog({ onClose }: { readonly onClose: () => void }) {
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down("sm"));
  const titleId = useId();
  const ingredients = useIngredients();
  const [search, setSearch] = useState("");
  const shown = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("de");
    return (ingredients.data ?? [])
      .filter((ingredient) => !ingredient.pantry && ingredient.name.toLocaleLowerCase("de").includes(query))
      .sort((a, b) => a.name.localeCompare(b.name, "de"));
  }, [ingredients.data, search]);

  return (
    <Dialog open onClose={onClose} fullScreen={fullScreen} fullWidth maxWidth="sm" aria-labelledby={titleId}>
      <DialogTitle id={titleId}>Preise</DialogTitle>
      <DialogContent>
        <Alert severity="info" sx={{ mb: 2 }}>
          Grobe Schätzpreise. Vorrat wie Salz und Öl zählt pauschal und steht nicht in der Liste.
        </Alert>
        <TextField
          label="Zutat suchen"
          size="small"
          fullWidth
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        {ingredients.isError && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {errorMessage(ingredients.error)}
          </Alert>
        )}
        <List aria-label="Zutatenpreise" dense>
          {shown.map((ingredient) => (
            <PriceRow key={ingredient.ingredientId} ingredient={ingredient} />
          ))}
        </List>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Fertig</Button>
      </DialogActions>
    </Dialog>
  );
}
