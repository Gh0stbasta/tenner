/** Household members (HOUSEHOLD-ADMIN-001): list, add, rename, recolor. Applies to the whole household. */

import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import PersonAddAlt1OutlinedIcon from "@mui/icons-material/PersonAddAlt1Outlined";
import { Alert, Button, IconButton, List, ListItem, ListItemIcon, ListItemText } from "@mui/material";
import { useState } from "react";
import { errorMessage } from "../../api/errorMessages";
import { useMembers, type Member } from "../members/api";
import { ColorSwatch, MemberDialog } from "../members/MemberDialog";
import { SettingsSection } from "./SettingsSection";

export function MembersSettings() {
  const members = useMembers();
  /** undefined = closed, null = add, Member = edit */
  const [editing, setEditing] = useState<Member | null | undefined>(undefined);

  return (
    <SettingsSection
      title="Haushaltsmitglieder"
      description="Gilt für alle im Haushalt. Neue Mitglieder können sich beim ersten Login mit Google selbst zuordnen."
    >
      {members.isError && (
        <Alert severity="error">Mitglieder konnten nicht geladen werden. {errorMessage(members.error)}</Alert>
      )}
      <List dense disablePadding aria-label="Mitglieder">
        {(members.data ?? []).map((member) => (
          <ListItem
            key={member.userId}
            disableGutters
            secondaryAction={
              <IconButton edge="end" aria-label={`${member.displayName} bearbeiten`} onClick={() => setEditing(member)}>
                <EditOutlinedIcon />
              </IconButton>
            }
          >
            <ListItemIcon sx={{ minWidth: 28 }}>
              <ColorSwatch color={member.color} />
            </ListItemIcon>
            <ListItemText primary={member.displayName} secondary={member.userId} />
          </ListItem>
        ))}
      </List>
      <Button
        startIcon={<PersonAddAlt1OutlinedIcon />}
        onClick={() => setEditing(null)}
        disabled={!members.isSuccess}
        sx={{ mt: 1 }}
      >
        Mitglied hinzufügen
      </Button>
      {editing !== undefined && (
        <MemberDialog key={editing?.userId ?? "new"} member={editing} onClose={() => setEditing(undefined)} />
      )}
    </SettingsSection>
  );
}
