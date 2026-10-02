import SearchOffOutlinedIcon from "@mui/icons-material/SearchOffOutlined";
import { Button } from "@mui/material";
import { Link } from "react-router";
import { EmptyState } from "../components/EmptyState";

export function NotFoundPage() {
  return (
    <EmptyState
      icon={<SearchOffOutlinedIcon aria-hidden />}
      title="Seite nicht gefunden"
      description="Diese Adresse gibt es nicht."
      action={
        <Button component={Link} to="/dashboard" variant="contained">
          Zum Dashboard
        </Button>
      }
    />
  );
}
