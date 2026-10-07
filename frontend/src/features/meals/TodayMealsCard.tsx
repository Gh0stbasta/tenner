/** Dashboard card „Heute essen wir“ (FOOD-009): today's lunch and dinner, linking to the meal plan. */

import RestaurantOutlinedIcon from "@mui/icons-material/RestaurantOutlined";
import { Box, Button, Card, CardContent, Typography } from "@mui/material";
import { Link as RouterLink } from "react-router";
import { useMealPlan } from "./api";
import { MEAL_SLOT_LABELS } from "./labels";
import { localToday } from "./format";

export function TodayMealsCard() {
  const plan = useMealPlan("current");
  const today = localToday();
  const slots = plan.data?.ready ? plan.data.slots.filter((slot) => slot.date === today) : [];
  if (slots.length === 0) return null;
  return (
    <Card component="section" aria-label="Heute essen wir" sx={{ mb: 3 }}>
      <CardContent sx={{ display: "flex", alignItems: "center", gap: 2, flexWrap: "wrap", pb: "16px !important" }}>
        <RestaurantOutlinedIcon color="primary" aria-hidden />
        <Box sx={{ flexGrow: 1 }}>
          <Typography variant="subtitle2" component="h2">
            Heute essen wir
          </Typography>
          {slots.map((slot) => (
            <Typography key={slot.slotId} variant="body2">
              {MEAL_SLOT_LABELS[slot.slot]}: {slot.dish?.name ?? "nichts geplant"}
            </Typography>
          ))}
        </Box>
        <Button component={RouterLink} to="/essen" size="small">
          Zum Essensplan
        </Button>
      </CardContent>
    </Card>
  );
}
