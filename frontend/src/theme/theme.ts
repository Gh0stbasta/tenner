/** Central MUI theme (FRONTEND-001): calm light theme, system fonts (no external font requests, CSP). */

import { createTheme } from "@mui/material/styles";
import type { CSSProperties } from "react";

declare module "@mui/material/styles" {
  interface TypographyVariants {
    metric: CSSProperties;
  }
  interface TypographyVariantsOptions {
    metric?: CSSProperties;
  }
}

declare module "@mui/material/Typography" {
  interface TypographyPropsVariantOverrides {
    metric: true;
  }
}

const fontFamily = [
  "system-ui",
  "-apple-system",
  '"Segoe UI"',
  "Roboto",
  '"Helvetica Neue"',
  "Arial",
  "sans-serif",
].join(",");

export const theme = createTheme({
  palette: {
    mode: "light",
    primary: { main: "#1976d2" },
    secondary: { main: "#2e7d32" },
    background: { default: "#f6f8fa", paper: "#ffffff" },
  },
  shape: { borderRadius: 12 },
  typography: {
    fontFamily,
    // Page titles, section titles, body and metric values (FRONTEND-001 typography standards).
    h1: { fontSize: "1.75rem", fontWeight: 600, lineHeight: 1.3 },
    h2: { fontSize: "1.25rem", fontWeight: 600, lineHeight: 1.4 },
    h3: { fontSize: "1.05rem", fontWeight: 600, lineHeight: 1.4 },
    body1: { fontSize: "1rem" },
    body2: { fontSize: "0.9rem" },
    metric: { fontFamily, fontSize: "2rem", fontWeight: 700, lineHeight: 1.1 },
    button: { textTransform: "none", fontWeight: 600 },
  },
  components: {
    MuiTypography: { defaultProps: { variantMapping: { metric: "p" } } },
    MuiCard: { defaultProps: { variant: "outlined" } },
    MuiButton: { defaultProps: { disableElevation: true } },
  },
});
