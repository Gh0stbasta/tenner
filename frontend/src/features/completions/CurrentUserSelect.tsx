import PersonOutlineIcon from "@mui/icons-material/PersonOutlined";
import { MenuItem, TextField } from "@mui/material";
import { USER_IDS, USER_LABELS, type UserId } from "../../types/domain";
import { useCurrentUser, useSetCurrentUser } from "./CurrentUserProvider";

/** Header control: who is using the app on this device (FRONTEND-007). */
export function CurrentUserSelect() {
  const user = useCurrentUser();
  const setUser = useSetCurrentUser();
  return (
    <TextField
      select
      size="small"
      value={user}
      onChange={(event) => setUser(event.target.value as UserId)}
      slotProps={{
        htmlInput: { "aria-label": "Ich bin" },
        select: { renderValue: (value) => USER_LABELS[value as UserId], IconComponent: PersonOutlineIcon },
      }}
      sx={{
        minWidth: 110,
        "& .MuiOutlinedInput-root": { color: "inherit", bgcolor: "rgba(255,255,255,0.12)" },
        "& .MuiOutlinedInput-notchedOutline": { borderColor: "rgba(255,255,255,0.4)" },
        "& .MuiSvgIcon-root": { color: "inherit" },
      }}
    >
      {USER_IDS.map((id) => (
        <MenuItem key={id} value={id}>
          {USER_LABELS[id]}
        </MenuItem>
      ))}
    </TextField>
  );
}
