/**
 * „Tafel“ (MAINT-022): full-screen overview for a large screen, made for the Echo Show 21 in its Silk browser (opened
 * by voice, MAINT-023). Meals of today or the week with photos, today's open Aufgaben and the shopping list; read-only,
 * refreshes itself and asks the browser to keep the screen on.
 */

import { Box, CssBaseline, Stack, ThemeProvider, ToggleButton, ToggleButtonGroup, Typography } from "@mui/material";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useDashboard } from "../dashboard/api";
import { useMealPlan, useShoppingList, type PlanSlot } from "../meals/api";
import { DishImage } from "../meals/DishImage";
import { localToday } from "../meals/format";
import { MEAL_SLOT_LABELS } from "../meals/labels";
import { formatQuantity } from "../meals/shopping";
import { createAppTheme } from "../../theme/theme";
import {
  dayLabel,
  daysOf,
  headerDate,
  headerTime,
  openShopping,
  readTafelView,
  TAFEL_REFRESH_MS,
  writeTafelView,
  type TafelDay,
  type TafelView,
} from "./tafel";

const storage = (): Storage | undefined => (typeof window === "undefined" ? undefined : window.localStorage);

/** The clock in the header, updated every 30 seconds. */
function useNow(): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(timer);
  }, []);
  return now;
}

/** Reload plan, Aufgaben and list every few minutes; the page usually stays open all day. */
function useSelfRefresh(): void {
  const queryClient = useQueryClient();
  useEffect(() => {
    const timer = window.setInterval(() => void queryClient.invalidateQueries(), TAFEL_REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [queryClient]);
}

/** Keep the screen on where the browser supports the Screen Wake Lock API; silently nothing elsewhere. */
function useWakeLock(): void {
  useEffect(() => {
    let lock: { release: () => Promise<void> } | undefined;
    let cancelled = false;
    const request = async () => {
      try {
        const wakeLock = (
          navigator as Navigator & {
            wakeLock?: { request: (type: "screen") => Promise<{ release: () => Promise<void> }> };
          }
        ).wakeLock;
        const acquired = await wakeLock?.request("screen");
        if (cancelled) void acquired?.release();
        else lock = acquired;
      } catch {
        // Not allowed or not supported: the device's own screen settings apply.
      }
    };
    void request();
    // A wake lock ends when the page is hidden; ask again when it is shown.
    const onVisible = () => document.visibilityState === "visible" && void request();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisible);
      void lock?.release().catch(() => undefined);
    };
  }, []);
}

function Panel({ title, children }: { readonly title: string; readonly children: ReactNode }) {
  return (
    <Box
      component="section"
      aria-label={title}
      sx={{ bgcolor: "background.paper", borderRadius: 3, p: 3, minHeight: 0 }}
    >
      <Typography variant="h2" sx={{ fontSize: "1.8rem", fontWeight: 600, mb: 2 }}>
        {title}
      </Typography>
      {children}
    </Box>
  );
}

const Hint = ({ children }: { readonly children: ReactNode }) => (
  <Typography color="text.secondary" sx={{ fontSize: "1.4rem" }}>
    {children}
  </Typography>
);

function Meal({ slot, size }: { readonly slot: PlanSlot | undefined; readonly size: "large" | "small" }) {
  const large = size === "large";
  const label = slot ? MEAL_SLOT_LABELS[slot.slot] : "";
  return (
    <Box sx={{ minWidth: 0 }}>
      {slot?.dish ? (
        <DishImage
          name={slot.dish.name}
          category={slot.dish.category}
          imageKey={slot.dish.imageKey}
          height={large ? 260 : 90}
        />
      ) : (
        <Box sx={{ height: large ? 260 : 90, borderRadius: 1, bgcolor: "action.hover" }} />
      )}
      <Typography color="text.secondary" sx={{ fontSize: large ? "1.3rem" : "0.95rem", mt: 1 }}>
        {label}
      </Typography>
      <Typography sx={{ fontSize: large ? "2.2rem" : "1.1rem", fontWeight: 600, lineHeight: 1.2 }} noWrap={!large}>
        {slot?.dish?.name ?? "–"}
      </Typography>
    </Box>
  );
}

function MealsToday({ day }: { readonly day: TafelDay | undefined }) {
  if (!day) return <Hint>Für heute ist noch nichts geplant.</Hint>;
  return (
    <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 3 }}>
      <Meal slot={day.lunch} size="large" />
      <Meal slot={day.dinner} size="large" />
    </Box>
  );
}

function MealsWeek({ days, today }: { readonly days: readonly TafelDay[]; readonly today: string }) {
  if (days.length === 0) return <Hint>Für diese Woche gibt es noch keinen Essensplan.</Hint>;
  return (
    <Box sx={{ display: "grid", gridTemplateColumns: `repeat(${days.length}, minmax(0, 1fr))`, gap: 2 }}>
      {days.map((day) => (
        <Box
          key={day.date}
          aria-label={dayLabel(day.date)}
          aria-current={day.date === today ? "date" : undefined}
          sx={{
            p: 1.5,
            borderRadius: 2,
            border: 2,
            borderColor: day.date === today ? "primary.main" : "transparent",
            display: "grid",
            gap: 1.5,
            minWidth: 0,
          }}
        >
          <Typography sx={{ fontSize: "1.3rem", fontWeight: 600 }}>
            {day.date === today ? `Heute · ${dayLabel(day.date)}` : dayLabel(day.date)}
          </Typography>
          <Meal slot={day.lunch} size="small" />
          <Meal slot={day.dinner} size="small" />
        </Box>
      ))}
    </Box>
  );
}

export function TafelPage() {
  const theme = useMemo(() => createAppTheme("dark"), []);
  const now = useNow();
  useSelfRefresh();
  useWakeLock();
  const [view, setView] = useState<TafelView>(() => readTafelView(storage()));
  const plan = useMealPlan("current");
  const dashboard = useDashboard();
  const shopping = useShoppingList("current");
  const today = localToday(now);
  const days = daysOf(plan.data);
  const tasks = [...(dashboard.data?.overdue ?? []), ...(dashboard.data?.dueToday ?? [])];
  const { shown, more } = openShopping(shopping.data?.items);

  const changeView = (next: TafelView | null) => {
    if (!next) return;
    setView(next);
    writeTafelView(storage(), next);
  };

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box
        component="main"
        aria-label="Tafel"
        sx={{ minHeight: "100vh", p: 3, display: "grid", gap: 3, gridTemplateRows: "auto 1fr" }}
      >
        <Stack direction="row" sx={{ alignItems: "center", justifyContent: "space-between", gap: 2 }}>
          <Box>
            <Typography component="h1" sx={{ fontSize: "2.6rem", fontWeight: 700, lineHeight: 1.1 }}>
              {headerDate(now)}
            </Typography>
            <Typography color="text.secondary" sx={{ fontSize: "1.6rem" }} aria-label="Uhrzeit">
              {headerTime(now)}
            </Typography>
          </Box>
          <ToggleButtonGroup
            exclusive
            value={view}
            onChange={(_, next: TafelView | null) => changeView(next)}
            aria-label="Ansicht Essen"
          >
            <ToggleButton value="DAY" sx={{ fontSize: "1.3rem", px: 3 }}>
              Heute
            </ToggleButton>
            <ToggleButton value="WEEK" sx={{ fontSize: "1.3rem", px: 3 }}>
              Woche
            </ToggleButton>
          </ToggleButtonGroup>
        </Stack>
        <Box sx={{ display: "grid", gap: 3, gridTemplateColumns: { xs: "1fr", lg: "2fr 1fr" }, minHeight: 0 }}>
          <Panel title={view === "DAY" ? "Heute essen wir" : "Diese Woche"}>
            {plan.isPending ? (
              <Hint>Essensplan wird geladen …</Hint>
            ) : plan.isError ? (
              <Hint>Der Essensplan konnte nicht geladen werden.</Hint>
            ) : view === "DAY" ? (
              <MealsToday day={days.find((day) => day.date === today)} />
            ) : (
              <MealsWeek days={days} today={today} />
            )}
          </Panel>
          <Stack spacing={3} sx={{ minHeight: 0 }}>
            <Panel title="Heute erledigen wir">
              {dashboard.isPending ? (
                <Hint>Aufgaben werden geladen …</Hint>
              ) : dashboard.isError ? (
                <Hint>Die Aufgaben konnten nicht geladen werden.</Hint>
              ) : tasks.length === 0 ? (
                <Hint>Heute steht nichts an.</Hint>
              ) : (
                <Box component="ul" aria-label="Offene Aufgaben" sx={{ m: 0, pl: 3, display: "grid", gap: 1 }}>
                  {tasks.map((task) => (
                    <Typography component="li" key={task.tennerId} sx={{ fontSize: "1.5rem" }}>
                      {task.title}
                    </Typography>
                  ))}
                </Box>
              )}
            </Panel>
            <Panel title="Einkaufsliste">
              {shopping.isPending ? (
                <Hint>Einkaufsliste wird geladen …</Hint>
              ) : shopping.isError ? (
                <Hint>Noch keine Einkaufsliste für diese Woche.</Hint>
              ) : shown.length === 0 ? (
                <Hint>Nichts einzukaufen.</Hint>
              ) : (
                <>
                  <Box component="ul" aria-label="Einkaufen" sx={{ m: 0, pl: 3, columns: 2, columnGap: 4 }}>
                    {shown.map((item) => (
                      <Typography component="li" key={item.key} sx={{ fontSize: "1.4rem", breakInside: "avoid" }}>
                        {[formatQuantity(item), item.name].filter(Boolean).join(" ")}
                      </Typography>
                    ))}
                  </Box>
                  {more > 0 && <Hint>+ {more} weitere</Hint>}
                </>
              )}
            </Panel>
          </Stack>
        </Box>
      </Box>
    </ThemeProvider>
  );
}
