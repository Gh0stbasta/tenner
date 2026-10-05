/**
 * Household members (HOUSEHOLD-ADMIN-001, -004): list, add, rename, recolor, deactivate and reactivate.
 * Applies to the whole household.
 */

import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import PersonAddAlt1OutlinedIcon from "@mui/icons-material/PersonAddAlt1Outlined";
import PersonOffOutlinedIcon from "@mui/icons-material/PersonOffOutlined";
import RestoreOutlinedIcon from "@mui/icons-material/RestoreOutlined";
import { Alert, Box, Button, IconButton, List, ListItem, ListItemIcon, ListItemText } from "@mui/material";
import { useState } from "react";
import { errorMessage } from "../../api/errorMessages";
import { useNotify } from "../../components/NotificationProvider";
import { useCurrentUser } from "../completions/CurrentUserProvider";
import { useMembers, useReactivateMember, type Member } from "../members/api";
import { DeactivateMemberDialog } from "../members/DeactivateMemberDialog";
import { ColorSwatch, MemberDialog } from "../members/MemberDialog";
import { SettingsSection } from "./SettingsSection";

export function MembersSettings() {
  const members = useMembers();
  const currentUser = useCurrentUser();
  const reactivate = useReactivateMember();
  const notify = useNotify();
  /** undefined = closed, null = add, Member = edit */
  const [editing, setEditing] = useState<Member | null | undefined>(undefined);
  const [deactivating, setDeactivating] = useState<Member | null>(null);
  const list = members.data ?? [];
  const activeCount = list.filter((member) => member.active).length;

  return (
    <SettingsSection
      title="Haushaltsmitglieder"
      description="Gilt für alle im Haushalt. Neue Mitglieder können sich beim ersten Login mit Google selbst zuordnen."
    >
      {members.isError && (
        <Alert severity="error">Mitglieder konnten nicht geladen werden. {errorMessage(members.error)}</Alert>
      )}
      <List dense disablePadding aria-label="Mitglieder">
        {list.map((member) => (
          <ListItem key={member.userId} disableGutters sx={{ opacity: member.active ? 1 : 0.6, pr: 0 }}>
            <ListItemIcon sx={{ minWidth: 28 }}>
              <ColorSwatch color={member.color} />
            </ListItemIcon>
            <ListItemText
              primary={member.displayName}
              secondary={member.active ? member.userId : `${member.userId} · Deaktiviert`}
            />
            <Box sx={{ display: "flex", flexShrink: 0 }}>
              <IconButton aria-label={`${member.displayName} bearbeiten`} onClick={() => setEditing(member)}>
                <EditOutlinedIcon />
              </IconButton>
              {member.active ? (
                // Not yourself (you would lock yourself out) and not the last active member.
                member.userId !== currentUser &&
                activeCount > 1 && (
                  <IconButton aria-label={`${member.displayName} deaktivieren`} onClick={() => setDeactivating(member)}>
                    <PersonOffOutlinedIcon />
                  </IconButton>
                )
              ) : (
                <IconButton
                  aria-label={`${member.displayName} reaktivieren`}
                  disabled={reactivate.isPending}
                  onClick={() =>
                    reactivate.mutate(member.userId, {
                      onSuccess: () => notify({ message: `${member.displayName} reaktiviert.` }),
                      onError: (error) =>
                        notify({ message: `Reaktivieren fehlgeschlagen. ${errorMessage(error)}`, severity: "error" }),
                    })
                  }
                >
                  <RestoreOutlinedIcon />
                </IconButton>
              )}
            </Box>
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
      {deactivating && <DeactivateMemberDialog member={deactivating} onClose={() => setDeactivating(null)} />}
    </SettingsSection>
  );
}
