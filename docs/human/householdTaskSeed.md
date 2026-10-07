# DATA-001: Seed Household With Real Recurring Responsibilities

## Goal

Populate Tenner with a realistic household task catalog based on the current family workflow.

The objective is to make the application immediately usable without manually entering recurring tasks.

---

# Additional Household Member

Create:

Household Member

```text
Haushaltshilfe
```

Purpose:

External cleaning support.

---

# Household Members

```text
Stefan
Julia
Haushaltshilfe
```

---

# Daily Tasks

## Stefan

### Robot Vacuum Ground Floor

Frequency:

Daily

Estimated Minutes:

1

Category:

HOUSEHOLD

---

### Robot Vacuum Upper Floor

Frequency:

Daily

Estimated Minutes:

1

Category:

HOUSEHOLD

---

### Kitchen Reset

Description:

Clean kitchen properly after dinner and prepare for next day.

Frequency:

Daily

Estimated Minutes:

10

Assigned To:

Stefan

---

## Julia

### Laundry Cycle

Description:

Collect laundry, start machine, hang clothes, sort laundry.

Frequency:

Daily

Estimated Minutes:

10

Assigned To:

Julia

---

# Every 3 Days

### Take Out Trash

Frequency:

3 Days

Estimated Minutes:

5

Assigned To:

Stefan

---

# Weekly Tasks

## Monday

### Small Bathroom

Estimated Minutes:

10

Assigned To:

Stefan

---

### Mirrors

Estimated Minutes:

5

Assigned To:

Stefan

---

## Tuesday

### Upper Floor Dusting

Estimated Minutes:

10

Assigned To:

Stefan

---

### Upper Bathroom

Estimated Minutes:

10

Assigned To:

Julia

---

## Wednesday

### Ground Floor Dusting

Estimated Minutes:

10

Assigned To:

Stefan

---

## Thursday

### Joker Day

Reserved Catch-Up Slot

No fixed task.

---

## Friday

### Quarterly Rotation Task

Frequency:

Every Friday

Rotation Group:

12 Week Cycle

Estimated Minutes:

10

Assigned To:

Stefan

---

## Saturday

### Semiannual Rotation Task

Frequency:

Every Saturday

Rotation Group:

26 Week Cycle

Estimated Minutes:

10

Assigned To:

Stefan

---

## Sunday

No standard tasks.

---

# Household Help

Assigned To:

```text
Haushaltshilfe
```

Tasks:

### Deep Floor Cleaning

Frequency:

Weekly

Estimated Minutes:

60

---

### Weekly Dusting

Frequency:

Weekly

Estimated Minutes:

60

---

# 12 Week Rotation Catalog

Create recurring rotation Tenners:

### Clean Refrigerator

### Clean Oven

### Declutter Bathroom

### Declutter Kids Room

### Declutter Bedroom

### Declutter Wardrobe

### Declutter Basement

### Declutter Storage Room

### Clean Pantry

### Clean Entry Area

### Organize Documents

### Household Maintenance Review

Each task repeats every:

```text
84 days
```

---

# 26 Week Rotation Catalog

### Windows Part 1

### Windows Part 2

### Windows Part 3

### Windows Part 4

### Check Smoke Detectors

### Deep Kitchen Cleaning

### Deep Bathroom Cleaning

### Garage / Keller Maintenance

### Outdoor Cleaning

### Seasonal Organization

Each task repeats every:

```text
182 days
```

---

# Implementation

Use seed data.

Do not require manual creation.

Execute automatically for newly created households.

---

# Acceptance Criteria

- Stefan tasks available
- Julia tasks available
- Haushaltshilfe available
- Daily tasks configured
- Weekly tasks configured
- 12 week cycle configured
- 26 week cycle configured
- Seed data loads automatically
