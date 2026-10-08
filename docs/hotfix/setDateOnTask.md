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
