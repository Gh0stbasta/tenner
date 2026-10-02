# FRONTEND-001: Establish Frontend Foundation

## Type

Frontend Foundation

---

## Priority

Critical

---

## Goal

Create the complete frontend foundation for the Tenner web application.

This ticket establishes:

- React application
- TypeScript configuration
- Routing
- UI framework
- API integration foundation
- State management
- Error handling
- Testing framework
- Application layout foundation

No business pages should be implemented yet.

The objective is to create a clean, scalable frontend architecture that future tickets can build upon.

---

# Background

The backend platform already provides:

- Dashboard API
- Tenner CRUD APIs
- Completion workflows
- AWS infrastructure
- Frontend hosting infrastructure
- CI/CD deployment pipeline

The frontend now needs a solid architectural foundation.

---

# Technology Stack

## Framework

```text
React
```

---

## Language

```text
TypeScript
```

Strict mode enabled.

---

## Build Tool

```text
Vite
```

---

## UI Framework

```text
Material UI (MUI)
```

Requirements:

```text
MUI Core

MUI Icons
```

---

## Routing

```text
React Router
```

---

## API State Management

```text
TanStack Query
```

Use TanStack Query for:

```text
Caching

Loading States

Refetching

Mutation Handling
```

---

## Forms

```text
React Hook Form
```

---

## Validation

```text
Zod
```

Frontend validation must mirror backend validation contracts.

---

## Testing

```text
Vitest

React Testing Library
```

---

# Application Structure

Create:

```text
frontend/

├── src/
│
├── api/
│
├── components/
│
├── features/
│
├── hooks/
│
├── layouts/
│
├── pages/
│
├── routes/
│
├── services/
│
├── theme/
│
├── types/
│
├── utils/
│
├── tests/
│
└── assets/
```

---

# Architectural Principles

## Feature-Oriented Design

Future functionality should be grouped by feature.

Example:

```text
features/

├── dashboard/

├── tenners/

├── analytics/
```

Avoid:

```text
100+ files in components/
```

---

## API Isolation

All API communication must be centralized.

Create:

```text
api/client.ts
```

Responsibility:

```text
Base URL

Error Handling

Request Configuration

Response Mapping
```

No page should directly use fetch.

---

## Reusable Components

Create a foundation for:

```text
Buttons

Dialogs

Forms

Cards

Loading Indicators

Error States
```

No business-specific UI required yet.

---

# Routing Foundation

Create routes for future pages.

Required routes:

```text
/

/dashboard

/tenners

/analytics

/settings
```

Pages may initially show:

```text
Coming Soon
```

---

# Application Layout

Create a reusable application layout.

Must include:

```text
Header

Navigation

Content Area
```

Layout should work for:

```text
Desktop

Tablet

Mobile
```

---

# Navigation

Create navigation entries:

```text
Dashboard

Tenners

Analytics

Settings
```

Analytics and Settings may remain placeholders.

---

# Theme Foundation

Create centralized MUI theme.

Requirements:

```text
Light Theme

Tenner Branding

Global Typography

Global Colors

Responsive Design
```

Suggested palette:

```text
Primary:
#1976d2

Secondary:
#2e7d32
```

Implementation details left to engineer.

---

# Environment Configuration

Create:

```text
.env.example
```

Required variables:

```text
VITE_API_URL
```

Example:

```text
VITE_API_URL=https://api.example.com
```

Create centralized config access.

Avoid direct use of:

```typescript
import.meta.env
```

throughout the codebase.

---

# API Foundation

Create typed API client.

Implement:

```typescript
get()

post()

put()

delete()
```

with centralized:

```text
Error Handling

JSON Parsing

Response Validation
```

---

# Loading States

Create reusable components:

```text
Page Loading

Section Loading

Skeleton Loading
```

---

# Error Handling

Create reusable components:

```text
Error Alert

Error Boundary

Not Found Page
```

---

# Empty States

Create reusable components:

```text
No Tenners Found

No Dashboard Data

No Analytics Available
```

Business usage comes later.

---

# Typography

Establish application standards.

Examples:

```text
Page Titles

Section Titles

Body Text

Metric Values
```

Use MUI theme configuration.

---

# Icons

Standardize icon usage.

Preferred:

```text
@mui/icons-material
```

Do not mix icon libraries.

---

# Accessibility

Minimum requirements:

```text
Keyboard Navigation

Screen Reader Labels

Semantic HTML

Color Contrast Compliance
```

---

# Responsive Design

The application must support:

```text
Mobile

Tablet

Desktop
```

Navigation may collapse to a drawer on smaller devices.

---

# Developer Experience

Configure:

```text
ESLint

Prettier

TypeScript Strict Mode
```

Requirements:

```text
No Warnings

No Any Types Unless Justified
```

---

# Testing Foundation

Create examples for:

```text
Component Test

Hook Test

API Mock Test
```

---

# CI/CD Integration

Frontend build must execute successfully using:

```bash
npm run build
```

within GitHub Actions.

---

# Documentation

Create:

```text
frontend/README.md
```

Document:

```text
Architecture

Project Structure

Routing

State Management

Theme Strategy

Development Commands
```

---

# Deliverables

Create:

```text
React Application

MUI Setup

Routing

TanStack Query Setup

API Client

Theme

Layout

Navigation

Testing Framework

Developer Tooling
```

Update:

```text
frontend/README.md

docs/architecture.md
```

---

# Validation

The following must succeed:

```bash
npm install

npm run lint

npm run build

npm run test
```

---

# Acceptance Criteria

- React application created
- TypeScript strict mode enabled
- Vite configured
- Material UI configured
- Routing configured
- TanStack Query configured
- API client implemented
- Theme implemented
- Layout implemented
- Navigation implemented
- Build succeeds
- Tests succeed
- Documentation updated

---

# Definition of Done

- Frontend architecture established
- Future pages can be implemented independently
- API integration foundation available
- Responsive layout available
- Build pipeline operational
- Ready for Dashboard implementation

---

# Out of Scope

Do not implement:

- Dashboard Page
- Tenner List Page
- Create Tenner Dialog
- Edit Tenner Dialog
- Analytics Page
- Settings Page
- Authentication
- Business Logic

These capabilities will be implemented in subsequent frontend tickets.
``

---

# Implementation Status

Done 2026-10-02.

- All acceptance criteria met: React 19 + TypeScript strict + Vite 8, MUI 9 theme, React Router 8
  (`/` → `/dashboard`, `/tenners`, `/analytics`, `/settings`, not-found page), TanStack Query client,
  typed API client, responsive layout with navigation, Vitest/RTL tests, ESLint and Prettier.
- Validation: `npm run lint` (0 warnings), `npm run format:check`, `npm test` (39 tests, ~95% coverage),
  `npm run build`; rendered in Chromium at desktop and phone width without errors.
- Deviations and assumptions:
  - The UI is German (decision 2026-10-02). Placeholder pages say "Demnächst verfügbar".
  - The environment variable is `VITE_API_BASE_URL` (not `VITE_API_URL`) because `deploy.yml` already sets it.
  - TypeScript 6.0 instead of 7: typescript-eslint supports TypeScript < 6.1 only.
  - System fonts instead of Roboto: the CloudFront CSP blocks external font hosts.
  - Example tests: component (`components.test.tsx`), hook (`useDebouncedValue.test.ts`), API mock (`client.test.ts`).

