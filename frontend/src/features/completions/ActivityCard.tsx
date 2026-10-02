import CheckCircleOutlineOutlinedIcon from "@mui/icons-material/CheckCircleOutlineOutlined";
import { ListItem, ListItemIcon, ListItemText } from "@mui/material";
import { USER_LABELS } from "../../types/domain";
import { formatRelativeTime } from "../../utils/format";
import type { HistoryItem } from "./api";

/** One completion in the activity list: title, who and when. */
export function ActivityCard({ item, now }: { readonly item: HistoryItem; readonly now: Date }) {
  return (
    <ListItem disableGutters>
      <ListItemIcon sx={{ minWidth: 36, color: "secondary.main" }}>
        <CheckCircleOutlineOutlinedIcon aria-hidden />
      </ListItemIcon>
      <ListItemText
        primary={item.tennerTitle ?? "Gelöschter Tenner"}
        secondary={
          <>
            Erledigt von {USER_LABELS[item.completedBy]} ·{" "}
            <time dateTime={item.completedAt} title={new Date(item.completedAt).toLocaleString("de-DE")}>
              {formatRelativeTime(item.completedAt, now)}
            </time>
          </>
        }
      />
    </ListItem>
  );
}
