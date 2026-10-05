/**
 * Household members (HOUSEHOLD-ADMIN-001, -004): list, add, rename, recolor, deactivate and reactivate; hand a
 * member's Tenners over temporarily (HOUSEHOLD-004). Applies to the whole household.
 */

import AssignmentReturnOutlinedIcon from "@mui/icons-material/AssignmentReturnOutlined";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import PersonAddAlt1OutlinedIcon from "@mui/icons-material/PersonAddAlt1Outlined";
import PersonOffOutlinedIcon from "@mui/icons-material/PersonOffOutlined";
import RestoreOutlinedIcon from "@mui/icons-material/RestoreOutlined";
import SwapHorizOutlinedIcon from "@mui/icons-material/SwapHorizOutlined";
import { Alert, Box, Button, IconButton, List, ListItem, ListItemIcon, ListItemText } from "@mui/material";
import { useState } from "react";
import { errorMessage } from "../../api/errorMessages";
import { useNotify } from "../../components/NotificationProvider";
import { formatShortDate } from "../../utils/format";
import { useCurrentUser } from "../completions/CurrentUserProvider";
import { useEndHandover, useHandovers } from "../household/api";
import { useMemberName, useMembers, useReactivateMember, type Member } from "../members/api";
import { DeactivateMemberDialog } from "../members/DeactivateMemberDialog";
import { HandoverDialog } from "../members/HandoverDialog";
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
  const [handingOver, setHandingOver] = useState<Member | null>(null);
  const handovers = useHandovers();
  const endHandover = useEndHandover();
  const memberName = useMemberName();
  const list = members.data ?? [];
  const activeCount = list.filter((member) => member.active).length;

  const describe = (member: Member): string => {
    if (!member.active) return `${member.userId} · Deaktiviert`;
    const handover = handovers.find((candidate) => candidate.from === member.userId);
    return handover
      ? `${member.userId} · Vertreten von ${memberName(handover.to)} bis ${formatShortDate(handover.until)}`
      : member.userId;
  };

  const end = (member: Member) =>
    endHandover.mutate(member.userId, {
      onSuccess: (result) =>
        notify({ message: `Vertretung beendet. ${result.returned} Tenner zurück an ${member.displayName}.` }),
      onError: (error) =>
        notify({ message: `Vertretung beenden fehlgeschlagen. ${errorMessage(error)}`, severity: "error" }),
    });

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
            <ListItemText primary={member.displayName} secondary={describe(member)} />
            <Box sx={{ display: "flex", flexShrink: 0 }}>
              {member.active &&
                (handovers.some((handover) => handover.from === member.userId) ? (
                  <IconButton
                    aria-label={`Vertretung für ${member.displayName} beenden`}
                    disabled={endHandover.isPending}
                    onClick={() => end(member)}
                  >
                    <AssignmentReturnOutlinedIcon />
                  </IconButton>
                ) : (
                  activeCount > 1 && (
                    <IconButton
                      aria-label={`Tenner von ${member.displayName} übergeben`}
                      onClick={() => setHandingOver(member)}
                    >
                      <SwapHorizOutlinedIcon />
                    </IconButton>
                  )
                ))}
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
      {handingOver && <HandoverDialog member={handingOver} onClose={() => setHandingOver(null)} />}
    </SettingsSection>
  );
}
