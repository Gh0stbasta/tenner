import LogoutIcon from "@mui/icons-material/Logout";
import PersonOutlinedIcon from "@mui/icons-material/PersonOutlined";
import { Button, ListItemIcon, Menu, MenuItem } from "@mui/material";
import { useState } from "react";
import { useCurrentUser, useLogout } from "../features/completions/CurrentUserProvider";
import { USER_LABELS } from "../types/domain";

/** Header: the logged-in household member (read-only, from the token) and logout (SECURITY-003). */
export function UserMenu() {
  const user = useCurrentUser();
  const logout = useLogout();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  return (
    <>
      <Button
        color="inherit"
        startIcon={<PersonOutlinedIcon />}
        aria-label={`Angemeldet als ${USER_LABELS[user]}`}
        aria-haspopup="menu"
        onClick={(event) => setAnchor(event.currentTarget)}
      >
        {USER_LABELS[user]}
      </Button>
      <Menu anchorEl={anchor} open={anchor !== null} onClose={() => setAnchor(null)}>
        <MenuItem
          onClick={() => {
            setAnchor(null);
            logout();
          }}
        >
          <ListItemIcon>
            <LogoutIcon fontSize="small" />
          </ListItemIcon>
          Abmelden
        </MenuItem>
      </Menu>
    </>
  );
}
