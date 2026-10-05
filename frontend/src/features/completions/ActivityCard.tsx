import CheckCircleOutlineOutlinedIcon from "@mui/icons-material/CheckCircleOutlineOutlined";
import { ListItem, ListItemIcon, ListItemText } from "@mui/material";
import { formatRelativeTime } from "../../utils/format";
import type { HistoryItem } from "./api";
import { useMemberName } from "../members/api";

/** One completion in the activity list: title, who and when. */
export function ActivityCard({ item, now }: { readonly item: HistoryItem; readonly now: Date }) {
  const memberName = useMemberName();
  return (
    <ListItem disableGutters>
      <ListItemIcon sx={{ minWidth: 36, color: "secondary.main" }}>
        <CheckCircleOutlineOutlinedIcon aria-hidden />
      </ListItemIcon>
      <ListItemText
        primary={item.tennerTitle ?? "Gelöschter Tenner"}
        secondary={
          <>
            Erledigt von {memberName(item.completedBy)} ·{" "}
            <time dateTime={item.completedAt} title={new Date(item.completedAt).toLocaleString("de-DE")}>
              {formatRelativeTime(item.completedAt, now)}
            </time>
          </>
        }
      />
    </ListItem>
  );
}
