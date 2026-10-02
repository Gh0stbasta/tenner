/**
 * Application layout (FRONTEND-001): header, navigation and content area.
 * Desktop: permanent side navigation. Tablet and mobile: drawer behind a menu button.
 */

import DashboardOutlinedIcon from "@mui/icons-material/DashboardOutlined";
import InsightsOutlinedIcon from "@mui/icons-material/InsightsOutlined";
import ListAltOutlinedIcon from "@mui/icons-material/ListAltOutlined";
import MenuIcon from "@mui/icons-material/Menu";
import SettingsOutlinedIcon from "@mui/icons-material/SettingsOutlined";
import {
  AppBar,
  Box,
  Drawer,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Toolbar,
  Typography,
} from "@mui/material";
import { useState, type ReactNode } from "react";
import { NavLink, Outlet } from "react-router";
import { NAVIGATION_ITEMS } from "./navigation";

export const DRAWER_WIDTH = 220;

const ICONS: Readonly<Record<string, ReactNode>> = {
  "/dashboard": <DashboardOutlinedIcon />,
  "/tenners": <ListAltOutlinedIcon />,
  "/analytics": <InsightsOutlinedIcon />,
  "/settings": <SettingsOutlinedIcon />,
};

function NavigationList({ onNavigate }: { readonly onNavigate?: () => void }) {
  return (
    <List component="nav" aria-label="Hauptnavigation">
      {NAVIGATION_ITEMS.map((item) => (
        <ListItemButton
          key={item.path}
          component={NavLink}
          to={item.path}
          onClick={onNavigate}
          sx={{ mx: 1, borderRadius: 2, "&.active": { bgcolor: "action.selected", fontWeight: 600 } }}
        >
          <ListItemIcon sx={{ minWidth: 40 }}>{ICONS[item.path]}</ListItemIcon>
          <ListItemText primary={item.label} />
        </ListItemButton>
      ))}
    </List>
  );
}

export interface AppLayoutProps {
  /** Extra content on the right side of the header (e.g. the current user selector). */
  readonly headerActions?: ReactNode;
}

export function AppLayout({ headerActions }: AppLayoutProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <Box sx={{ display: "flex", minHeight: "100vh" }}>
      <AppBar position="fixed" elevation={0} sx={{ zIndex: (theme) => theme.zIndex.drawer + 1 }}>
        <Toolbar>
          <IconButton
            color="inherit"
            edge="start"
            aria-label="Navigation öffnen"
            onClick={() => setMobileOpen(true)}
            sx={{ mr: 1, display: { md: "none" } }}
          >
            <MenuIcon />
          </IconButton>
          <Typography variant="h6" component="p" sx={{ flexGrow: 1, fontWeight: 700 }}>
            Tenner
          </Typography>
          {headerActions}
        </Toolbar>
      </AppBar>

      <Box component="aside" sx={{ width: { md: DRAWER_WIDTH }, flexShrink: { md: 0 } }}>
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={() => setMobileOpen(false)}
          ModalProps={{ keepMounted: true }}
          sx={{ display: { xs: "block", md: "none" }, "& .MuiDrawer-paper": { width: DRAWER_WIDTH } }}
        >
          <Toolbar />
          <NavigationList onNavigate={() => setMobileOpen(false)} />
        </Drawer>
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

      <Box component="main" sx={{ flexGrow: 1, minWidth: 0, p: { xs: 2, sm: 3 }, maxWidth: 1200, mx: "auto" }}>
        <Toolbar />
        <Outlet />
      </Box>
    </Box>
  );
}
