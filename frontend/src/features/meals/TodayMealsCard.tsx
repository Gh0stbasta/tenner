/**
 * Dashboard card „Heute essen wir“ (FOOD-009, UI-001): today's lunch and dinner, the most prominent card of the
 * dashboard (at least twice the height of the other cards), linking to the meal plan.
 */

import RestaurantOutlinedIcon from "@mui/icons-material/RestaurantOutlined";
import { Box, Button, Card, CardContent, Stack, Typography } from "@mui/material";
import { useId } from "react";
import { Link as RouterLink } from "react-router";
import { useMealPlan } from "./api";
import { MEAL_SLOT_LABELS } from "./labels";
import { localToday } from "./format";
import { DishImage } from "./DishImage";

export function TodayMealsCard() {
  const plan = useMealPlan("current");
  const headingId = useId();
  const today = localToday();
  const slots = plan.data?.ready ? plan.data.slots.filter((slot) => slot.date === today) : [];
  return (
    <Card component="section" aria-labelledby={headingId} sx={{ mb: 3, minHeight: { xs: 220, md: 260 } }}>
      <CardContent sx={{ height: "100%", display: "flex", flexDirection: "column", gap: 2, p: { xs: 2.5, md: 3 } }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
          <RestaurantOutlinedIcon color="primary" fontSize="large" aria-hidden />
          <Typography variant="h2" id={headingId} sx={{ fontSize: { xs: "1.4rem", md: "1.6rem" }, flexGrow: 1 }}>
            Heute essen wir
          </Typography>
        </Box>
        {slots.length === 0 ? (
          <Typography color="text.secondary">
            {plan.isPending ? "Essensplan wird geladen …" : "Für heute ist noch nichts geplant."}
          </Typography>
        ) : (
          <Stack direction={{ xs: "column", sm: "row" }} spacing={{ xs: 2, sm: 4 }}>
            {slots.map((slot) => (
              <Box key={slot.slotId} sx={{ flex: 1 }}>
                {slot.dish && (
                  <DishImage
                    name={slot.dish.name}
                    category={slot.dish.category}
                    imageKey={slot.dish.imageKey}
                    height={140}
                    sx={{ mb: 1 }}
                  />
                )}
                <Typography variant="overline" color="text.secondary" component="p">
                  {MEAL_SLOT_LABELS[slot.slot]}
                </Typography>
                <Typography sx={{ fontSize: { xs: "1.6rem", md: "2rem" }, fontWeight: 600, lineHeight: 1.2 }}>
                  {slot.dish?.name ?? "–"}
                </Typography>
              </Box>
            ))}
          </Stack>
        )}
        <Box sx={{ mt: "auto" }}>
          <Button component={RouterLink} to="/essen" size="small">
            Zum Essensplan
          </Button>
        </Box>
      </CardContent>
    </Card>
  );
}
