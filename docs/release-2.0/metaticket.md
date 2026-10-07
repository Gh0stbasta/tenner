Das ist aus meiner Sicht kein einzelnes Feature mehr.

Das ist:

Release 2.0
=
Family Meal Planning


Und ich würde Claude nicht direkt Tickets bauen lassen, sondern erst ein Epic, das die komplette Lösung zerlegt.

# EPIC-FOOD-001: Family Meal Planning Platform

## Goal

Create a complete meal-planning platform inside Tenner.

The platform should generate a weekly family meal plan from predefined dishes and household rules.

No AI is required for the initial implementation.

The first version should use deterministic planning rules and application logic.

---

# Background

Tenner is currently focused on recurring household responsibilities.

The next logical family-management capability is meal planning.

The family currently already follows a semi-structured meal plan and has a predefined catalog of preferred dishes.

The objective is to:

- remove planning overhead
- reduce decision fatigue
- ensure variety
- consider dietary restrictions
- support family routines

---

# Vision

Users open Tenner and see:

```text
This Week

Monday
Lunch
Dinner

Tuesday
Lunch
Dinner

...

Sunday
Lunch
Dinner
```

The plan should already be generated.

Users can:

- regenerate the entire week
- regenerate a single meal
- manually swap meals
- create new meals
- archive meals
- view estimated nutrition
- view estimated cost

---

# Create Domain

Create:

```text
backlog/food/
```

---

# Generate Implementation Tickets

Create all required implementation tickets.

Minimum breakdown:

FOOD-001 → FOOD-020+


Und die Tickets würde ich ungefähr so zerlegen:

FOOD-001
Meal Planning Architecture

FOOD-002
Dish Data Model


Enthält:

Name

Category

Ingredients

Protein Source

Preparation Time

Image

Nutrition

Cost

Household Suitability

FOOD-003
Seed Meal Catalog


Importiert alle aktuellen Gerichte von Stefan.

Das sind aktuell ungefähr:

40+ Gerichte

FOOD-004
Family Profile


Speichert:

Allergien

Vorlieben

Abneigungen

Kinder

Portionsgrößen

FOOD-005
Meal Planning Rules Engine


Umsetzung deiner Regeln:

Keine doppelte Proteinquelle

Kein Nudeln mittags + abends

Hühnchen max 1x/Woche

Max 20 Minuten Aufwand

Familientauglich

FOOD-006
Automatic Weekly Planner


Generiert:

7 Tage

Mittag

Abend

FOOD-007
Replace Single Meal


Funktion:

"Tausche Mittwoch Abend"

FOOD-008
Regenerate Entire Week

FOOD-009
Meal Dashboard


Visualisierung:

Montag

Mittag
Salat mit Protein

Abend
Burgerwraps

FOOD-010
Dish Editor


Neues Gericht anlegen.

FOOD-011
Dish Images


Upload:

Foto

Stockbild

KI-generiertes Bild

FOOD-012
Nutrition Calculator


Grobe Angabe:

Kalorien

Protein

Kohlenhydrate

Fett


Nicht wissenschaftlich exakt.

FOOD-013
Cost Estimation


Beispiel:

Familie

4-6 EUR
8-10 EUR
12-15 EUR

FOOD-014
Shopping List Generator


Extrem wertvoll.

Wochenplan
↓
Einkaufsliste

FOOD-015
Calendar Integration

FOOD-016
Meal Notifications


Morning:

Heute:

Mittag
Onigiri

Abend
Linseneintopf

FOOD-017
Alexa Integration


Beispiel:

Alexa, was gibt es heute?

FOOD-018
Echo Show Widget


Beispiel:

🍽️ Heute

Mittag:
Onigiri

Abend:
Lasagne

FOOD-019
Food Analytics


Zeigt:

Proteinquellen

Vegetarische Quote

Lieblingsgerichte

Kosten

FOOD-020
Version 2 Planning Engine


Später optional:

KI


für:

Variationen

Saisonale Gerichte

Resteverwertung


Mein Bauchgefühl:

Shopping List + Essensplan + Echo Show Widget wird langfristig deutlich häufiger genutzt werden als die Hausaufgabenfunktion.

Weil ihr jeden einzelnen Tag entscheiden müsst:

Was gibt's heute?


und genau diese Entscheidung kann Tenner komplett übernehmen. Das ist vermutlich das stärkste Feature nach Release 1.0. 🚀


---

hier noch kontext für die familie:
# 🍽️ Essensplan-Grundlage

## 👨‍👩‍👧‍👦 Familienstruktur

- **Julia**: geboren 1987, Mutter
- **Stefan**: geboren 1986, Ehemann
- **Drei Kinder**:
  - Kind 1: geboren 2020
  - Kind 2: geboren 2022
  - Kind 3: geboren 2024

---

## 🚫 Allergien & Unverträglichkeiten

- **Julia** ist allergisch gegen:
  - **Nüsse**
  - **Äpfel**

### Stefan (Ehemann):
- **Vegetarier**, aber:
  - isst gelegentlich **Hackfleisch** oder **Würstchen**
---

## 🧂 Ernährung & Vorlieben

### Allgemein:
- Familie isst gerne:
  - **Nudeln, Spätzle, Reis, Kartoffeln**
  - **Gemüse, Brokkoli, Bohnen, Spinat, Erbsen**
  - **Salat mit Protein**
  - **Pizza, Burger, Hot Dogs, Chicken Nuggets, Wraps**
  - **Fisch**: nur **Fischstäbchen oder Lachs**
  - **Käse**: z. B. **Camembert, Feta, Mozzarella, Parmesan**

---

## 🍽️ Lieblingsgerichte der Familie

- **Nudelgerichte:**
  - Nudeln mit Soße
  - Spaghetti Bolognese
  - One Pot Pasta
  - Käsemakkaroni
  - Ofenrigatoni
  - Tortellini
  - Ravioli
  - Lasagne
  - Nudelauflauf


- **Kartoffelgerichte:**
  - Kartoffelsuppe mit Würstl
  - Kartoffeln mit Butter
  - Kartoffelpuffer
  - Kartoffelmuffins
  - Bratkartoffeln mit Ei oder Würstl
  - Frikadellen mit Kartoffelbrei
  - Fischstäbchen-Auflauf mit Kartoffeln und Spinat
  - Rösti mit Kräuterquark
  - Gnocchi mit Spinat & Feta

- **Reisgerichte:**
  - Eierreis mit Gemüse
  - Mikrowellenrisotto
  - Chilli
  - Reispfanne mit Paprika & Zucchini
  - Curryreis mit Kokosmilch (mild)

- **Burger & Wraps:**
  - Burger
  - Burgerwraps
  - Piratenburger
  - Gemüsefrikadellen
  - Hot Dogs

- **Fleisch-/Fischgerichte:**
  - Spätzle mit Hackbraten oder Soße
  - Köttbullar
  - Chicken Dinos mit Pommes
  - Fischstäbchen mit Erbsenpüree
  - Gebratener Lachs mit Gemüse

- **Vegetarisch & Klassiker:**
  - Spätzle
  - Schupfnudeln
  - Grießbrei
  - Ofengemüse mit Kräuterquark
  - Gemüsecurry
  - Linseneintopf
  - Toast Hawaii
  - Flammkuchen
  - Ramen
  - Onigiri
  - Gnocchi in Tomatensoße
  - Gnocchi in Spinatsoße
  - Mozzarella-Tomaten-Baguettes aus dem Ofen
  - Pfannenpizza (mit Wrap als Boden)
  - Kaiserschmarrn mit Rosinen (optional weglassen)
  - Sandwiches aus dem Kontaktgrill (z. B. Tomate-Mozzarella)
  - Gemüse-Toasts aus dem Ofen (z. B. mit Zucchini & Käse)
  - Käsespätzle mit Röstzwiebeln (Ei & Käse)
  - Tortellini mit Frischkäsefüllung & Brokkoli
  - Gebratener Halloumi mit Ofengemüse
  - Eier in Senfsoße mit Kartoffeln

---

## 🚫 Abneigungen & Einschränkungen

- **Kein Tofu**
- **Kein Quinoa**
- **Keine Käsesoße mit Schimmelkäse**
- **Wenig Salate zu Mittag** (Salat grundsätzlich okay, aber nicht täglich mittags)
- **Keine doppelte Verwendung der gleichen Grundzutat an einem Tag**  
  z. B. nicht mittags und abends Nudeln
- **Keine Wiederholung von Proteinquellen innerhalb einer Woche**  
  z. B. Lachs, Hähnchen, Ei, Würstchen, Soja – je nur 1×/Woche
- **Hühnchen nur 1× pro Woche – entweder Montag oder Dienstag abends**
- **Mittagessen unter der Woche soll leicht & kalorienarm sein**
- **Frühstück ohne Kochaufwand** (nur Rührei am Wochenende erlaubt)

---

## 🍴 Küchenausstattung

- Herd mit 4 Kochfeldern
- Backofen
- Mikrowelle

---

## ⏱️ Zubereitungsregeln

- **Maximale Zubereitungszeit pro Mahlzeit:** 20 Minuten
- Gerichte sollen **einfach & familientauglich** sein
- **Frühstück unter der Woche**: kalt (Brot, Joghurt, Müsli etc.)
- **Mittagessen**: leicht & kalorienarm
- **Abendessen**: gerne warm und sättigend

---

## ✅ Planungsregeln auf einen Blick

- 🐔 **Hühnchen nur 1×/Woche**, Montag **ODER** Dienstag **abends**
- 🔁 **Keine doppelte Proteinquelle pro Woche**
- 🍝 **Keine doppelte Hauptzutat (z. B. Reis, Nudeln) an einem Tag**
- 🍽️ **Burger & Hühnchen je max. 1×/Woche**
- 🕒 **Zubereitungszeit pro Gericht max. 20 Minuten**

---

hier noch die essensliste:
- Nudeln mit Soße
- Burgerwraps
- Burger
- Gnocci mit Soße
- Kartoffelsuppe mit Würstl
- Chilli
- Lasagne
- Onigiri
- Salat mit Protein
- Eierreis mit Gemüse
- Gemüsecurry
- Linseneintopf
- Mikrowellenrisotto
- Spätzle mit Hackbraten od Soße
- Ofengemüse mit Kräuterquark
- Piratenburger
- Fischstäbchen mit Erbsenpürree
- Frikadellen mit Kartoffelbrei
- köttbulla 
- Spätzle 
- Chicken Dinos mit Pommes
- Schupfnudeln
- Grießbrei
- Käsemakkaroni
- Gemüsefrikadellen
- Kartoffelpuffer
- Ravioli
- Spaghetti Bolo
- One Pot Pasta
- Fischstäbchen-Auflauf mit Kartoffeln und Spinat
- Kartoffeln mit Butter
- Tortellini
- Ofenrigatoni
- Ramen
- Flammkuchen
- Gebratener Lachs mit Gemüse
- Toast Hawaii
- Bratkartoffeln mit Ei oder Würstl
- Kartoffelmuffins



