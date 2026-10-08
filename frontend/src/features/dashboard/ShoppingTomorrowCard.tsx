/**
 * „Für morgen einkaufen“ (UI-001): open shopping list items that tomorrow's meals need (FOOD-014, counts since
 * FOOD-028). Tomorrow can be in next week's list; a week without a plan has nothing to buy.
 */

import ShoppingCartOutlinedIcon from "@mui/icons-material/ShoppingCartOutlined";
import { Box, Button, Card, CardContent, List, ListItem, Typography } from "@mui/material";
import { useId } from "react";
import { Link as RouterLink } from "react-router";
import { useShoppingList } from "../meals/api";
import { localToday } from "../meals/format";
import { formatQuantity, itemsFor } from "../meals/shopping";

const addDays = (date: string, days: number): string => {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
};

export function ShoppingTomorrowCard() {
  const headingId = useId();
  const tomorrow = addDays(localToday(), 1);
  const current = useShoppingList("current");
  const inNextWeek = current.data !== undefined && tomorrow > addDays(current.data.weekStart, 6);
  const next = useShoppingList("next", inNextWeek);
  const list = inNextWeek ? next.data : current.data;
  const loading = current.isPending || (inNextWeek && next.isPending);
  const items = list ? itemsFor(list.items, tomorrow) : [];
  return (
    <Card component="section" aria-labelledby={headingId} sx={{ mb: 3 }}>
      <CardContent>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
          <ShoppingCartOutlinedIcon color="primary" aria-hidden />
          <Typography variant="h2" id={headingId} sx={{ fontSize: "1.2rem", flexGrow: 1 }}>
            Für morgen einkaufen
          </Typography>
        </Box>
        {loading && !current.isError ? (
          <Typography color="text.secondary">Einkaufsliste wird geladen …</Typography>
        ) : items.length === 0 ? (
          <Typography color="text.secondary">Keine Einkäufe notwendig</Typography>
        ) : (
          <List disablePadding aria-label="Einkauf für morgen">
            {items.map((item) => (
              <ListItem key={item.key} disableGutters sx={{ py: 0.25 }}>
                {[formatQuantity(item), item.name].filter(Boolean).join(" ")}
              </ListItem>
            ))}
          </List>
        )}
        <Button component={RouterLink} to="/einkaufsliste" size="small" sx={{ mt: 1 }}>
          Zur Einkaufsliste
        </Button>
      </CardContent>
    </Card>
  );
}
