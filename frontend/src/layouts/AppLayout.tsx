/**
 * Application layout (FRONTEND-001): header, navigation and content area.
 * From md (900 px): permanent side navigation. Below: bottom navigation and a Quick Add button within thumb reach
 * (MOBILE-005). Safe-area insets keep content clear of notches and the home indicator in the installed app.
 */

import DashboardOutlinedIcon from "@mui/icons-material/DashboardOutlined";
import InsightsOutlinedIcon from "@mui/icons-material/InsightsOutlined";
import ListAltOutlinedIcon from "@mui/icons-material/ListAltOutlined";
import RestaurantOutlinedIcon from "@mui/icons-material/RestaurantOutlined";
import AddIcon from "@mui/icons-material/Add";
import SettingsOutlinedIcon from "@mui/icons-material/SettingsOutlined";
import {
  AppBar,
  BottomNavigation,
  BottomNavigationAction,
  Box,
  Drawer,
  Fab,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Toolbar,
  Typography,
} from "@mui/material";
import type { ReactNode } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router";
import { ConnectivityBanner } from "../components/ConnectivityBanner";
import { PendingSyncIndicator } from "../features/offline/PendingSyncIndicator";
import { QUICK_ADD_INPUT_ID } from "../features/tenners/quickAdd";
import { NAVIGATION_ITEMS } from "./navigation";

export const DRAWER_WIDTH = 220;
/** Height of the bottom navigation (MUI default). */
const BOTTOM_NAV_HEIGHT = 56;

const ICONS: Readonly<Record<string, ReactNode>> = {
  "/dashboard": <DashboardOutlinedIcon />,
  "/tenners": <ListAltOutlinedIcon />,
  "/essen": <RestaurantOutlinedIcon />,
  "/analytics": <InsightsOutlinedIcon />,
  "/settings": <SettingsOutlinedIcon />,
};

function NavigationList() {
  return (
    <List component="nav" aria-label="Hauptnavigation">
      {NAVIGATION_ITEMS.map((item) => (
        <ListItemButton
          key={item.path}
          component={NavLink}
          to={item.path}
          sx={{ mx: 1, borderRadius: 2, "&.active": { bgcolor: "action.selected", fontWeight: 600 } }}
        >
          <ListItemIcon sx={{ minWidth: 40 }}>{ICONS[item.path]}</ListItemIcon>
          <ListItemText primary={item.label} />
        </ListItemButton>
      ))}
    </List>
  );
}

/** Bottom navigation below md (MOBILE-005). */
function BottomNavigationBar() {
  const location = useLocation();
  const current = NAVIGATION_ITEMS.find((item) => location.pathname.startsWith(item.path))?.path ?? false;
  return (
    <Box
      component="nav"
      aria-label="Hauptnavigation"
      sx={{
        display: { xs: "block", md: "none" },
        position: "fixed",
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: (theme) => theme.zIndex.appBar,
        borderTop: 1,
        borderColor: "divider",
        bgcolor: "background.paper",
        pb: "env(safe-area-inset-bottom)",
      }}
    >
      <BottomNavigation showLabels value={current}>
        {NAVIGATION_ITEMS.map((item) => (
          <BottomNavigationAction
            key={item.path}
            component={NavLink}
            to={item.path}
            value={item.path}
            label={item.label}
            icon={ICONS[item.path]}
            sx={{ minWidth: 0 }}
          />
        ))}
      </BottomNavigation>
    </Box>
  );
}

/** Quick Add within thumb reach: focuses the Quick Add input, or opens the dashboard with it focused. */
function QuickAddFab() {
  const navigate = useNavigate();
  const onClick = () => {
    const input = document.getElementById(QUICK_ADD_INPUT_ID);
    if (input) {
      input.focus();
      input.scrollIntoView({ block: "center", behavior: "smooth" });
    } else {
      void navigate("/dashboard?quickAdd=1");
    }
  };
  return (
    <Fab
      color="primary"
      aria-label="Tenner schnell anlegen"
      onClick={onClick}
      sx={{
        display: { xs: "flex", md: "none" },
        position: "fixed",
        right: 16,
        bottom: `calc(${BOTTOM_NAV_HEIGHT + 16}px + env(safe-area-inset-bottom))`,
        zIndex: (theme) => theme.zIndex.appBar,
      }}
    >
      <AddIcon />
    </Fab>
  );
}

export interface AppLayoutProps {
  /** Extra content on the right side of the header (e.g. the current user selector). */
  readonly headerActions?: ReactNode;
}

export function AppLayout({ headerActions }: AppLayoutProps) {
  return (
    <Box sx={{ display: "flex", minHeight: "100vh" }}>
      <AppBar
        position="fixed"
        elevation={0}
        sx={{ zIndex: (theme) => theme.zIndex.drawer + 1, pt: "env(safe-area-inset-top)" }}
      >
        <Toolbar>
          <Typography variant="h6" component="p" sx={{ flexGrow: 1, fontWeight: 700 }}>
            Tenner
          </Typography>
          {headerActions}
        </Toolbar>
      </AppBar>

      <Box component="aside" sx={{ width: { md: DRAWER_WIDTH }, flexShrink: { md: 0 } }}>
        <Drawer
          variant="permanent"
          open
          sx={{
            display: { xs: "none", md: "block" },
            "& .MuiDrawer-paper": { width: DRAWER_WIDTH, boxSizing: "border-box" },
          }}
        >
          <Toolbar />
          <NavigationList />
        </Drawer>
      </Box>

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          minWidth: 0,
          p: { xs: 2, sm: 3 },
          // Room for the bottom navigation, the Quick Add button and the home indicator below md.
          pb: { xs: `calc(${BOTTOM_NAV_HEIGHT + 88}px + env(safe-area-inset-bottom))`, md: 3 },
          pl: { xs: "max(16px, env(safe-area-inset-left))", sm: 3 },
          pr: { xs: "max(16px, env(safe-area-inset-right))", sm: 3 },
          maxWidth: 1200,
          mx: "auto",
        }}
      >
        <Toolbar sx={{ mt: "env(safe-area-inset-top)" }} />
        <ConnectivityBanner />
        <PendingSyncIndicator />
        <Outlet />
      </Box>
      <QuickAddFab />
      <BottomNavigationBar />
    </Box>
  );
}
