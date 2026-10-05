/** One-click completion (FRONTEND-007). Thumb-friendly; Enter and Space work as on every button. */

import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import { Button, type ButtonProps } from "@mui/material";
import { useCompletion, type CompleteRequest } from "./CompletionProvider";

export interface CompleteTennerButtonProps {
  readonly tenner: CompleteRequest;
  readonly color?: ButtonProps["color"];
  readonly variant?: ButtonProps["variant"];
  readonly disabled?: boolean;
}

export function CompleteTennerButton({
  tenner,
  color = "primary",
  variant = "contained",
  disabled = false,
}: CompleteTennerButtonProps) {
  const { complete, isCompleting } = useCompletion();
  return (
    <Button
      variant={variant}
      color={color}
      startIcon={<CheckCircleIcon />}
      onClick={() => complete({ tennerId: tenner.tennerId, title: tenner.title })}
      disabled={disabled || isCompleting(tenner.tennerId)}
      aria-label={`„${tenner.title}“ erledigen`}
      sx={{ flexShrink: 0, minHeight: 44 }}
    >
      Erledigt
    </Button>
  );
}
