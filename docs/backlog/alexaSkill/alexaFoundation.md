# ALEXA-001: Generate Complete Alexa & Echo Show Platform Backlog

## Type

Platform Expansion / Backlog Generation

---

## Priority

High

---

## Goal

Create a complete implementation backlog for the Tenner Alexa platform.

This backlog must cover:

- Alexa Skill
- Echo Show Application
- Voice Workflows
- Echo Show Dashboard
- Home Screen Widget/Card
- Daily Briefings
- Notifications
- Authentication
- Device Linking
- Operations

The generated backlog should allow Claude to implement the complete Alexa platform without additional discovery work.

---

# Background

Tenner currently supports:

```text
Web Application

Google Login

Dashboard

Analytics

Scheduling

Notifications (planned)

Mobile App (in progress)
```

The next platform should be:

```text
Amazon Alexa
```

with special focus on:

```text
Echo Show 5
Echo Show 8
Echo Show 10
Echo Show 15
```

---

# Strategic Objective

Tenner should become the household information hub.

The Alexa integration should allow users to:

```text
See household status

Receive reminders

Receive daily briefings

Complete Tenners

Interact by voice

Use Echo Show as a wall-mounted dashboard
```

without opening the web or mobile app.

---

# Target User Experience

## Voice

Examples:

```text
Alexa, open Tenner.

Alexa, what do I need to do today?

Alexa, what is overdue?

Alexa, complete Mobility.

Alexa, start my day.
```

---

## Echo Show Dashboard

Display:

```text
🏠 TENNER

Today

Stefan:
2 Tasks

Julia:
1 Task

15 Minutes Open
```

---

## Home Screen Widget

The Alexa platform must investigate and implement the maximum possible persistent visibility on Echo Show devices.

This includes:

```text
Alexa Widgets

Home Cards

Ambient Information

Home Screen Experiences

Persistent Household Status
```

Goal:

The user should be able to see Tenner information without explicitly launching the skill.

---

# Create New Domain

Create:

```text
backlog/alexa/
```

---

# Generate Implementation Tickets

Create the following tickets.

---

# ALEXA-001

Alexa Platform Foundation

Establish:

```text
Alexa Developer Setup

AWS Account Integration

Skill Structure

Deployment Strategy

CI/CD
```

---

# ALEXA-002

Account Linking

Implement:

```text
Alexa Account Linking

Cognito Integration

Google Identity Mapping

Household Authorization
```

---

# ALEXA-003

Today's Tenners Voice Experience

Implement:

```text
Alexa, what is due today?

Alexa, what should I do today?

Alexa, how much work is left?
```

---

# ALEXA-004

Completion Workflow

Implement:

```text
Alexa, complete Mobility

Alexa, complete Vacuum Office

Alexa, undo last completion
```

---

# ALEXA-005

Daily Briefing

Implement:

```text
Alexa, start my day
```

Response includes:

```text
Due Today

Overdue

Estimated Effort

Household Summary
```

---

# ALEXA-006

Echo Show Dashboard

Implement:

```text
Visual Dashboard

Today's Tenners

Overdue Tenners

Household Status

Workload Summary
```

Optimized for:

```text
Echo Show 8

Echo Show 10

Echo Show 15
```

---

# ALEXA-007

Echo Show Home Screen Widget / Card

Investigate and implement all supported Echo Show mechanisms for persistent visibility.

Topics:

```text
Widgets

Home Cards

Ambient Experiences

Persistent Dashboard Presence
```

Goal:

```text
Users see Tenner status directly on the Echo Show home screen.

No voice command required.
```

Example:

```text
🏠 TENNER

Today:
3 Tasks

15 Minutes Open

1 Overdue
```

This ticket should become the flagship Echo Show feature.

---

# ALEXA-008

Notifications & Announcements

Implement:

```text
Daily Briefing

Reminder Announcements

Overdue Alerts

Household Status Changes
```

---

# ALEXA-009

Operations & Monitoring

Implement:

```text
Observability

Error Monitoring

Skill Health Checks

Operational Runbooks

Analytics
```

---

# Ticket Requirements

Every generated ticket must contain:

```text
Goal

Background

Scope

Architecture Considerations

Deliverables

Acceptance Criteria

Definition Of Done

Out Of Scope
```

Follow existing project standards.

---

# Architecture Considerations

The generated backlog must evaluate:

```text
Alexa Skill Kit

Echo Show UI Capabilities

Widget APIs

Alexa Presentation Language (APL)

Voice Models

Account Linking

Lambda Integration

Analytics

Operational Monitoring
```

---

# Deliverables

Create:

```text
backlog/alexa/
```

Generate:

```text
ALEXA-001
ALEXA-002
ALEXA-003
ALEXA-004
ALEXA-005
ALEXA-006
ALEXA-007
ALEXA-008
ALEXA-009
```

as fully detailed implementation tickets.

---

# Acceptance Criteria

- Alexa domain created
- Voice workflows covered
- Echo Show dashboard covered
- Authentication covered
- Notifications covered
- Operations covered
- Home Screen widget/card covered
- Ticket numbering consistent
- Ticket format consistent

---

# Definition of Done

A complete Alexa and Echo Show roadmap exists.

Claude can implement the Alexa platform entirely from backlog tickets.

The roadmap includes both:

```text
Voice-first experiences
```

and

```text
Echo Show visual household dashboard experiences
```

with special emphasis on persistent home-screen visibility.

---

# Out of Scope

Do not implement:

- Alexa Skill
- Echo Show UI
- Lambda Code
- Infrastructure

This ticket is solely responsible for creating the Alexa implementation backlog.

---

# Implementation Status

Implemented 2026-10-05.

- [x] Alexa domain created: `docs/backlog/alexa/` (the repository keeps all tickets under `docs/backlog/`; the
  ticket's `backlog/alexa/` maps to it), listed in `docs/backlog/README.md` and `docs/roadmap.md`
- [x] Voice workflows covered: ALEXA-003 (today, overdue, suggestion, work left), ALEXA-004 (complete, undo),
  ALEXA-005 (daily briefing)
- [x] Echo Show dashboard covered: ALEXA-006 (APL views per Echo Show 5/8/10/15, touch completion)
- [x] Authentication covered: ALEXA-002 (Cognito account linking with Google sign-in, access tokens in the API,
  speaker → member mapping via voice profiles)
- [x] Notifications covered: ALEXA-008 (Proactive Events, Reminders API, as a channel of NOTIFICATION-001)
- [x] Operations covered: ALEXA-001 (CI/CD, Terraform), ALEXA-009 (logs, metrics, alarms, health check, runbooks)
- [x] Home screen widget/card covered: ALEXA-007 (flagship: APL widgets with Data Store pushes, spike with
  go/no-go, fallback plan)
- [x] Ticket numbering consistent (ALEXA-001 – 009 = `ticket001.md` – `ticket009.md`) and format consistent with
  the backlog (Type, Priority, Phase, Goal, Background, Dependencies, Scope, Architecture Considerations,
  Deliverables, Testing Requirements, Validation, Acceptance Criteria, Definition of Done, Out of Scope)

Platform facts behind the tickets (web research 2026-10-05; developer.amazon.com itself was not reachable from the
build environment, so each ticket repeats the facts it relies on and asks to verify them before implementing):

- Alexa Skills Kit Lambda trigger only in us-east-1, eu-west-1, us-west-2, ap-northeast-1; eu-west-1 recommended
  for German → the skill Lambda runs in eu-west-1 and calls the API in eu-central-1 (ALEXA-001).
- 8-second response limit; development-stage skills work on the developer account's devices; beta tests last at
  most 90 days; the Routines Kit is discontinued since 2026-05-13; Alexa+ is in early access in Germany.
- Cognito account linking with the authorization code grant; Alexa sends access tokens, so the API authorizer and
  identity must accept them (ALEXA-002).
- APL widgets on Echo Show 5/8/10/11/15/21 with the Data Store REST API; third-party widget availability for de-DE
  is unconfirmed → spike in ALEXA-007.
- Proactive Events allow predefined schemas only; Reminders API is active.

Decisions and assumptions:

- **ID clash:** this generation ticket's heading says "ALEXA-001", and the ticket also asks for a generated
  "ALEXA-001: Alexa Platform Foundation". The generated tickets keep ALEXA-001 – 009 as requested; this file is
  referred to as the Alexa backlog ticket (`alexaSkill/alexaFoundation.md`) and is not counted as ALEXA-001.
- German (de-DE) only, matching the household and the web app; voice phrases in the tickets are German.
- Development-stage skill for the household's Amazon account; no store publication or certification.
- FUTURE-010 (voice assistant evaluation) got an owner-decision note pointing here.
- Nothing was implemented (out of scope): no skill, UI, Lambda code or infrastructure.
