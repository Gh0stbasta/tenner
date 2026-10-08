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
