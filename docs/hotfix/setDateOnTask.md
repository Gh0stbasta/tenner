# HOTFIX-006: Startdatum für Aufgaben konfigurierbar machen

## Type

Hotfix

---

## Goal

Beim Erstellen oder Bearbeiten einer Aufgabe soll optional ein Startdatum ausgewählt werden können.

Dadurch können Aufgaben geplant werden, die erst in der Zukunft aktiv werden sollen.

---

## Background

Aktuell werden Aufgaben unmittelbar nach Erstellung aktiv.

Für saisonale Aufgaben, Rotationen, Essensplanung, Haushaltshilfe oder zukünftige Routinen soll ein individueller Startzeitpunkt möglich sein.

---

## Scope

### Aufgabe erstellen

Neues Feld:

```text
Startdatum
```

Kalenderauswahl (Date Picker).

---

### Aufgabe bearbeiten

Startdatum nachträglich änderbar.

---

### Aufgabenlogik

Vor Erreichen des Startdatums:

```text
Aufgabe erscheint nicht im Dashboard
Aufgabe wird nicht als fällig berechnet
Aufgabe erzeugt keine Erinnerungen
```

Ab dem Startdatum:

```text
Normale Fälligkeits- und Wiederholungslogik
```

---

## UI

Bezeichnung:

```text
Startdatum
```

Standardwert:

```text
Heute
```

---

## Acceptance Criteria

- Startdatum auswählbar
- Kalender-Picker vorhanden
- Startdatum speicherbar
- Aufgaben vor Startdatum nicht sichtbar
- Aufgaben vor Startdatum erzeugen keine Erinnerungen
- Bestehende Aufgaben erhalten automatisch Startdatum = Erstellungsdatum

---

## Definition of Done

Startdatum kann beim Erstellen und Bearbeiten von Aufgaben gesetzt werden und beeinflusst die Fälligkeit korrekt.

---

# Implementation Status

Umgesetzt am 2026-10-08.

- **Datenmodell:** Aufgaben haben ein optionales Feld `startDate`. Aufgaben, die vor diesem Hotfix angelegt wurden,
  haben keins gespeichert. Für sie gilt automatisch das Erstellungsdatum als Startdatum (`startDateOf`, UTC-Datum von
  `createdAt`). Eine Datenmigration ist nicht nötig.
- **Anlegen:** Das Feld „Startdatum“ (Kalenderauswahl) steht mit dem Standardwert heute im Dialog. Die Aufgabe ist
  erstmals am Startdatum fällig (`nextDue = Startdatum`). Ein Datum in der Vergangenheit bedeutet „heute fällig“.
- **Bearbeiten:** Das Startdatum ist änderbar.
  - Ab heute oder in der Zukunft verschiebt es auch die nächste Fälligkeit auf diesen Tag.
  - Ein Datum in der Vergangenheit wird nur gespeichert und ändert die Fälligkeit nicht.
- **Vor dem Startdatum:**
  - Die Aufgabe ist nicht fällig, weil `nextDue` in der Zukunft liegt.
  - Das Dashboard zeigt sie nicht, auch nicht unter „Demnächst“.
  - Es gibt keine Erinnerungen, weil diese nur fällige und überfällige Aufgaben betreffen.
  - Die Aufgabenliste unter „Aufgaben“ zeigt sie weiter, damit sie bearbeitet werden kann.
- **Danach:** Es gilt die normale Fälligkeits- und Wiederholungslogik.

## Annahmen

- Der Katalog-Import setzt weiter seine eigenen ersten Fälligkeiten (DATA-008). Als Startdatum gilt dort der Tag
  des Imports.
- Das Startdatum alter Aufgaben ist das UTC-Datum der Erstellung. In Europe/Berlin liegt es nie nach dem lokalen Tag.

## Tests

- `backend/tests/start-date.test.ts`, `backend/tests/create-tenner.test.ts`.
- `frontend/src/features/tenners/CreateTennerDialog.test.tsx`, `EditTennerDialog.test.tsx`.
