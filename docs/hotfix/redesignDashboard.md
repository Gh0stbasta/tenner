# UI-001: Dashboard Redesign – Fokus auf den heutigen Tag

## Type

UI / UX Improvement

---

## Goal

Das Dashboard der Zentrale soll nicht länger ein Aufgaben-Reporting darstellen, sondern die aktuelle Tagesübersicht der Familie.

Der Fokus liegt ausschließlich auf:

- Was wird heute gegessen?
- Welche Aufgaben stehen heute an?
- Was muss für morgen noch eingekauft werden?

---

## Background

Das Dashboard enthält aktuell viele Informationen, die wenig Mehrwert liefern:

- Heute fällig
- Überfällig
- Demnächst
- Minuten offen
- Aufgaben nach Person
- Aufgaben nach Kategorie
- Schnellerstellung von Aufgaben

Diese Informationen werden bereits in den jeweiligen Fachbereichen bereitgestellt.

Das Dashboard soll stattdessen zur täglichen Startseite der Familie werden.

---

## Entfernen

### Aufgabe direkt erstellen

Entfernen:

```text
Aufgabe erstellen
```

Aufgaben werden im Bereich:

```text
Aufgaben
```

erstellt.

---

### Kennzahlen entfernen

Komplett entfernen:

```text
Heute fällig

Überfällig

Demnächst

Minuten offen
```

---

### Verteilungen entfernen

Komplett entfernen:

```text
Nach Person

Nach Kategorie
```

---

### Bereich "Demnächst"

Komplett entfernen.

---

## Neuer Dashboard-Fokus

### Heute essen wir

Diese Karte wird zum wichtigsten Element des Dashboards.

Anforderungen:

- mindestens doppelte Höhe
- deutlich prominenter
- direkt sichtbar beim Öffnen

Anzeige:

```text
Mittag

Onigiri

Abend

Lasagne
```

Optional später:

```text
Kalorien

Kosten

Zubereitungszeit
```

---

### Heutige Aufgaben

Anzeige:

```text
Heute

✅ Roboter EG

✅ Roboter OG

⬜ Küche aufräumen

⬜ Müll rausbringen
```

Nur heute relevante Aufgaben.

Keine Zukunftsdaten.

---

### Einkauf für morgen

Neue Dashboard-Karte.

Zeigt ausschließlich:

```text
Artikel benötigt für morgen
```

Beispiel:

```text
Milch

Spaghetti

Hackfleisch

Tomaten
```

Wenn leer:

```text
Keine Einkäufe notwendig
```

---

## Zielbild

Dashboard soll sich anfühlen wie:

```text
ZENTRALE

Heute essen wir

Heute erledigen wir

Für morgen einkaufen
```

und nicht wie ein Reporting- oder Analysebereich.

---

## Acceptance Criteria

- Aufgabe erstellen entfernt
- Heute fällig entfernt
- Überfällig entfernt
- Demnächst entfernt
- Minuten offen entfernt
- Nach Person entfernt
- Nach Kategorie entfernt
- Heute essen wir deutlich größer
- Heutige Aufgaben sichtbar
- Einkauf für morgen sichtbar
- Dashboard konzentriert sich ausschließlich auf den aktuellen Tag

---

## Definition of Done

Das Dashboard wird zur täglichen Familienübersicht und zeigt ausschließlich die für heute relevanten Informationen.

---

# Implementation Status

Umgesetzt am 2026-10-08.

- **Dashboard** (`frontend/src/features/dashboard/DashboardPage.tsx`): Überschrift „Heute“ mit Datum, ohne
  Kennzahlen. Darunter drei Karten:
  - **Heute essen wir** (`meals/TodayMealsCard.tsx`): die größte Karte, mindestens 220 bzw. 260 px hoch, mit
    Mittag und Abend in großer Schrift. Ohne Plan steht dort „Für heute ist noch nichts geplant.“
  - **Heute erledigen wir** (`dashboard/TodayTasksCard.tsx`):
    - Oben stehen die heute erledigten Aufgaben, abgehakt und durchgestrichen (aus „Zuletzt erledigt“).
    - Darunter stehen die offenen Aufgaben von heute, jeweils mit Erledigen-Haken. Erledigen, Wischen, Verschieben
      und Überspringen funktionieren wie bisher, „Rückgängig“ inklusive.
    - Überfällige Aufgaben gibt es seit REC-001 kaum noch. Erscheinen sie doch, stehen sie in dieser Liste.
  - **Für morgen einkaufen** (`dashboard/ShoppingTomorrowCard.tsx`): offene Einträge der Einkaufsliste, die eine
    Mahlzeit von morgen braucht, mit Stückzahlen (FOOD-028). Am letzten Tag der Woche kommen sie aus der Liste der
    nächsten Woche. Ohne Einträge steht dort „Keine Einkäufe notwendig“.
- **Entfernt:**
  - „Aufgabe erstellen“ (Schnell anlegen), die Kennzahlen, „Heute fällig“, „Überfällig“, „Demnächst“, „Pausiert“,
    „Nach Person“, „Nach Kategorie“ und „Zuletzt erledigt“.
  - Der Bereich „Dashboard“ in den Einstellungen, dessen Schalter nichts mehr bewirken.
- **Aufgaben anlegen:**
  - Der Plus-Knopf auf dem Handy und die App-Verknüpfung „Neue Aufgabe“ öffnen jetzt „Aufgaben“ mit dem
    Schnell-Anlegen (`/tenners?quickAdd=1`).

## Annahmen

- „Heute erledigen wir“ zeigt die Aufgaben des ganzen Haushalts. Die Person steht unter jedem Eintrag.
- Erledigte Aufgaben kommen aus den letzten 10 Erledigungen. An einem sehr vollen Tag können ältere erledigte
  Aufgaben fehlen. Das ist als TD-043 notiert.

## Tests

- `frontend/src/features/dashboard/DashboardPage.test.tsx`.
- Angepasst: `meals/MealPlanPage.test.tsx`, `settings/SettingsPage.test.tsx`, `mobile/Mobile.test.tsx`,
  `install/Install.test.tsx`.
