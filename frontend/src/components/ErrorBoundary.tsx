/** Top-level error boundary (FRONTEND-001, UX-005): fallback instead of a blank page. */

import { Alert, AlertTitle, Box, Button } from "@mui/material";
import { Component, type ErrorInfo, type ReactNode } from "react";

export interface ErrorBoundaryProps {
  readonly children: ReactNode;
  /** Called by the "Neu laden" button. Default: reload the page. */
  readonly onReload?: () => void;
}

interface ErrorBoundaryState {
  readonly hasError: boolean;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  override state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    // Remote reporting follows with OBSERVABILITY-005.
    console.error("Unhandled rendering error", { message: error.message, componentStack: info.componentStack });
  }

  private readonly reload = (): void => {
    if (this.props.onReload) this.props.onReload();
    else window.location.reload();
  };

  override render(): ReactNode {
    if (!this.state.hasError) return this.props.children;
    return (
      <Box sx={{ p: 3, maxWidth: 560, mx: "auto" }}>
        <Alert
          severity="error"
          action={
            <Button color="inherit" size="small" onClick={this.reload}>
              Neu laden
            </Button>
          }
        >
          <AlertTitle>Etwas ist schiefgelaufen</AlertTitle>
          Die Seite konnte nicht angezeigt werden. Bitte lade sie neu.
        </Alert>
      </Box>
    );
  }
}
