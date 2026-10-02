import { Alert, AlertTitle, Button } from "@mui/material";

export interface ErrorAlertProps {
  readonly title?: string;
  readonly message: string;
  readonly onRetry?: () => void;
}

/** Inline error with an optional retry action (FRONTEND-001). */
export function ErrorAlert({ title = "Das hat nicht geklappt", message, onRetry }: ErrorAlertProps) {
  return (
    <Alert
      severity="error"
      action={
        onRetry && (
          <Button color="inherit" size="small" onClick={onRetry}>
            Erneut versuchen
          </Button>
        )
      }
    >
      <AlertTitle>{title}</AlertTitle>
      {message}
    </Alert>
  );
}
