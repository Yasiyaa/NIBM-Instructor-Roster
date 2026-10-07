# NIBM INSTRUCTOR ROSTER & TASK ALLOCATION SYSTEM
## Comprehensive Engineering Context Anchor & System Architecture Specification

> **Target Environment**: Production Vercel Deployment + Neon Serverless PostgreSQL  
> **Institution**: National Institute of Business Management (NIBM) — School of Computing  
> **Role Context**: Senior Architect / Lead Engineer Handbook  
> **Last Verified**: September 2026 (Passing 12/12 Automated Domain Tests, 0 ESLint Warnings, Turbopack Build Clean)

---

## 1. Executive Mission & System Purpose

This system is an enterprise-grade academic operations platform designed for NIBM's School of Computing. It replaces legacy manual timetabling and brittle spreadsheet/JSON prototypes with an ACID-compliant, role-governed scheduling engine.

### Primary Operational Objectives:
1. **Sunday Planning Studio**: Empower Roster Masters (Demonstrators) to construct, validate, duplicate, and publish weekly lecture and lab allocations without scheduling conflicts.
2. **Situational Awareness Cockpit**: Provide executive leadership (Director / Dr. Thisara) with real-time operational visibility into available human capital (free standby instructors), active lectures, and tonight's night duty caretaker.
3. **Faculty Self-Service & Accountability**: Give technical cadre members instant personal timetable access, overlap-checked leave application workflows, and self-service credential/contact management.
4. **Public Lobby Display**: Zero-auth kiosk dashboard for campus lobby monitors, synchronized to Sri Lanka Standard Time (SLST / UTC+5:30) with real-time active session highlighting.

---

## 2. Technology Stack Specification

| Layer | Technology | Details / Configuration |
| :--- | :--- | :--- |
| **Framework** | Next.js 16.3.5 (App Router) | Turbopack engine, Server Components + Client Islands |
| **Runtime / UI** | React 19.2.8 | Functional components, Server Actions, modern hooks |
| **Language** | TypeScript 5 | Strict mode, zero `any` tolerance on domain entities |
| **Styling** | Tailwind CSS v4 | Clean institutional slate/indigo/emerald aesthetic, `@media print` optimized |
| **Database** | Neon Serverless PostgreSQL | AWS `us-east-2`, Transaction Pooling (`pgbouncer=true`) |
| **ORM** | Prisma 6.19.3 | Singleton client, ACID transactions (`$transaction`), auto `postinstall` |
| **Security / Auth**| `jose` (JWT) + `bcryptjs` | HTTP-Only, SameSite signed session cookies, salted password hashing |
| **Validation** | `zod` 4.6.5 | Runtime input schema validation on all Server Actions |
| **Hosting Target**| Vercel | Serverless functions, Edge-friendly, zero Docker dependencies |
| **CI/CD** | GitHub Actions | Automated build, lint, and domain rule tests (`.github/workflows/ci.yml`) |

---

## 3. The Core Cadre Model & Non-Negotiable Invariants

### A. The 9-Member Teaching Cadre Rule
The academic teaching cadre consists of **strictly 9 individuals**:
- **3 Demonstrators (Roster Masters)**:
  1. `yasith@nibm.lk` — **Yasith** (Phone: `071 257 0137`)
  2. `kithnuka@nibm.lk` — **Kithnuka** (Phone: `076 783 3449`)
  3. `sandali@nibm.lk` — **Sandali**
  *All three have equal permissions: full scheduling, 1-click duplication, publishing, and leave approval/rejection authority.*
- **6 Technical Instructors**:
  4. `nithara@nibm.lk` — **Nithara** (Phone: `074 015 0405`)
  5. `nipun@nibm.lk` — **Nipun** (Phone: `071 217 9220`)
  6. `gimasha@nibm.lk` — **Gimasha** (Phone: `077 116 4048`)
  7. `binal@nibm.lk` — **Binal** (Phone: `071 305 5035`)
  8. `poorna@nibm.lk` — **Poorna** (Phone: `071 553 6337`)
  9. `supun@nibm.lk` — **Supun** (Phone: `075 792 2488`, Technical Assistant)
- **Executive Leadership**:
  - `thisara@nibm.lk` — **Dr. Thisara** (Executive / Director, Phone: `071 987 6543`). Full cockpit visibility, leave approval authority, direct WhatsApp emergency contact.
- **Campus Lab Kiosk**:
  - `instructors@nibm.lk` — **Instructors Portal** (General terminal shared login, Phone: `011 268 5697`).

*(Default password for all seeded accounts: `123`, salted and hashed using bcrypt).*

### B. Mathematical Free-Standby Invariant
At any given operational moment or filter slot:
$$\text{FreeStandby} = 9 - (\text{OnDuty} + \text{OnLeave})$$
Every member of the 9-person teaching cadre must exist in **exactly one** of the three mutually exclusive operational states:
1. **On Duty**: Assigned to a scheduled lecture, lab session, or CCS module.
2. **On Leave**: Covered by an approved `LeaveRequest` spanning the date.
3. **Free Standby**: Available in the staff room for emergency student consultations, lab maintenance, or substitute cover.

### C. Hard Scheduling Constraints
1. **Instructor Double-Booking Collision**: An instructor cannot be assigned to two duties whose time intervals overlap on the same date.
2. **Room / Lab Collision**: Two different student batches cannot be scheduled in the same physical venue/lab during overlapping hours.
3. **Approved Leave Lockout**: If an instructor has an `APPROVED` leave request spanning `dutyDate`, the system **must reject** any duty assignment and night shift allocation.
4. **Night Duty Exclusivity**: Maximum of 1 night duty caretaker per calendar date. An instructor on approved leave cannot be assigned night shift.

---

## 4. Neon PostgreSQL & Database Architecture

### A. Crucial Neon Connection Pooler Rule
Neon's AWS serverless pooler runs in **transaction pooling mode**. When connecting Prisma to Neon, the connection string in `.env` **MUST** include `&pgbouncer=true`:
```env
DATABASE_URL="postgresql://[USER]:[PASSWORD]@[HOST]-pooler.c-6.us-east-2.aws.neon.tech/neondb?sslmode=require&connect_timeout=30&pool_timeout=30&connection_limit=10&pgbouncer=true"
JWT_SECRET="enterprise-nibm-roster-secret-key-32-chars-min!!"
```
*Omission of `&pgbouncer=true` causes Prisma to attempt prepared statements which transaction poolers forcibly drop (`Error { kind: Closed, cause: None }`).*

### B. Prisma Schema Overview (`prisma/schema.prisma`)
- `User`: `id`, `fullName`, `email` (unique), `passwordHash`, `role` (`DEMONSTRATOR`, `INSTRUCTOR`, `EXECUTIVE`), `phone`, `avatarColor`, `isActive`.
- `RosterWeek`: `id`, `weekNumber`, `startDate`, `endDate`, `status` (`DRAFT`, `PUBLISHED`).
- `DutyAssignment`: `id`, `rosterWeekId`, `instructorId`, `dutyDate`, `slotLabel`, `startTime`, `endTime`, `batchName`, `moduleName`, `roomLab`, `notes`.
  *Unique constraint*: `@@unique([dutyDate, startTime, instructorId])`.
- `NightShift`: `id`, `rosterWeekId`, `instructorId`, `shiftDate`, `notes`.
  *Unique constraint*: `@@unique([shiftDate, instructorId])`.
- `LeaveRequest`: `id`, `instructorId`, `startDate`, `endDate`, `reason`, `status` (`PENDING`, `APPROVED`, `REJECTED`), `reviewedById`, `reviewedAt`, `reviewComment`.
- `AuditLog`: `id`, `userId`, `action`, `targetEntity`, `targetId`, `metadata`, `createdAt`.

---

## 5. Directory Structure & Key Files

```
NIBM-Instructor-Roster/
├── .github/workflows/ci.yml      # CI/CD pipeline (lint, build, domain tests)
├── prisma/
│   ├── schema.prisma             # PostgreSQL schema definition
│   └── seed.ts                   # Database seed (9 cadre + 1 exec + 1 kiosk)
├── scripts/
│   └── verify-domain-rules.ts    # 12 automated domain invariant tests
├── src/
│   ├── app/
│   │   ├── layout.tsx            # Root layout
│   │   └── page.tsx              # Server component entry point (loads initial data + user session)
│   ├── components/
│   │   ├── MainApp.tsx           # Client root state container & tab router
│   │   ├── Header.tsx            # Top nav, role badges, profile trigger
│   │   ├── ProfileModal.tsx      # Self-service phone & bcrypt password modal
│   │   ├── LoginPage.tsx         # Modern auth page with quick-role demo buttons
│   │   ├── SundayPlanner.tsx     # 7-day planning studio (Yasith & Kithnuka)
│   │   ├── ExecutiveDashboard.tsx# Dr. Thisara's situational cockpit
│   │   ├── WeeklyScheduleView.tsx# Master weekly schedule, print view, CSV export
│   │   ├── InstructorPortal.tsx  # Cadre portal, personal duties, leave request
│   │   ├── LeaveManagement.tsx   # Leave approvals table with CSV export
│   │   ├── PublicStatusBoard.tsx # Campus lobby monitor with live digital clock
│   │   └── ui/Badge.tsx          # Institutional color-coded badge component
│   ├── lib/
│   │   ├── db.ts                 # Prisma Client singleton
│   │   ├── auth.ts               # JWT cookie session management & bcrypt helpers
│   │   ├── storage.ts            # High-performance Prisma queries & transactions
│   │   └── actions.ts            # Zod-validated Server Actions (Mutations & Auth)
│   └── types/
│       └── index.ts              # Core TypeScript interfaces & enum types
├── package.json                  # Scripts: dev, build, lint, test, postinstall
└── CONTEXT_ANCHOR.md             # This comprehensive architecture file
```

---

## 6. Verification & Operational Commands

```bash
# 1. Install dependencies (triggers automatic prisma generate)
npm install

# 2. Run local development server
npm run dev

# 3. Run automated domain integrity test suite (12 tests against Neon DB)
npm test

# 4. Code quality & linting check (zero warnings tolerance)
npm run lint

# 5. Production Next.js build verification
npm run build

# 6. Database schema sync & seeding
npx prisma db push
npx tsx prisma/seed.ts
```

---

## 7. Implemented Features & Architecture Status

The following core roadmap and enterprise features are fully implemented and verified:

1. ✅ **WhatsApp Cadre Dispatcher & Group Broadcast Hub**:
   - Location: `SundayPlanner.tsx`.
   - Functionality: 1-click personalized WhatsApp messages (`wa.me/<phone>?text=...`) for each instructor detailing their specific weekly lectures, plus a copy-ready broadcast for the NIBM Faculty WhatsApp group.
2. ✅ **Academic Calendar Sync (`.ics` Feed)**:
   - Location: Serverless Route `src/app/api/calendar/[instructorId]/route.ts`.
   - Functionality: Dynamic iCalendar feed allowing instructors to click "Subscribe to Calendar" in `InstructorPortal.tsx` to automatically sync duties to Google Calendar, Apple Calendar, and Outlook (RFC 5545 compliant, UTC+5:30 offset).
3. ✅ **Executive Audit Trail & Compliance Drawer**:
   - Location: `ExecutiveDashboard.tsx` and `Header.tsx`.
   - Functionality: Searchable UI leveraging the `AuditLog` table, showing timestamped records of who scheduled duties, approved/rejected leaves, altered rosters, or modified the catalog.
4. ✅ **Historical Week Cloning & Semester Snapshot Archive**:
   - Location: `SundayPlanner.tsx`.
   - Functionality: 1-click copy of the entire previous week's timetable into the new planning week, with automatic collision and leave re-validation.
5. ✅ **Dynamic Academic Catalog (Batch & Venue Manager)**:
   - Location: `SundayPlanner.tsx` and `prisma/schema.prisma` (`Catalog` singleton model).
   - Functionality: Manage student batches (`DSE 24.1F`, `DCSD 24.1P`) and lecture rooms/labs dynamically from the UI rather than hardcoded presets.
6. ✅ **Enterprise Admin & User Management**:
   - Location: `AdminUserManagement.tsx`, `ChangePasswordScreen.tsx`, `src/lib/auth.ts`, `src/lib/session.ts`.
   - Functionality: Full administrator panel (`ADMIN` role), account provisioning with temporary password generation, forced first-login password change, user active/inactive toggles, and HS256 JWT secure session cookies (`jose`).
7. ✅ **Prisma Database Migrations & Neon Branch Testing**:
   - Location: `prisma/migrations/`, `prisma/schema.prisma`, `scripts/verify-domain-rules.ts`.
   - Functionality: Version-controlled migrations (`20260920092624_init_auth_and_domain`, `20260920093500_fix_nightshift_unique`), strict `@@unique([shiftDate])` for night shifts, and test branch isolation via `TEST_DATABASE_URL`.

---

## 8. Development Ground Rules for AI Agents & Engineers

- **Preserve Mathematical Invariants**: Under no circumstance should a change violate the $N = 9$ cadre rule or allow an instructor to be double-booked or scheduled while on approved leave.
- **Maintain Zero-Warning Cleanliness**: Always verify `npm run lint` and `npm run build` after completing edits.
- **Zero Raw Passwords**: All credential mutations must be validated with current password verification and hashed with `bcrypt.hash(password, 10)`.
- **Database Safety**: All destructive or multi-record mutations in `src/lib/storage.ts` or `src/lib/actions.ts` must execute inside `prisma.$transaction`.
