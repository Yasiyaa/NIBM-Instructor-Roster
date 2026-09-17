# NIBM Instructor Roster & Duty Allocation System

Enterprise roster and duty allocation system built for the **National Institute of Business Management (NIBM)**, School of Computing.

Provides real-time visibility into the 8-member instructor cadre: who is actively teaching, who is on approved leave, who is available on standby for ad-hoc allocations, and who is assigned to overnight campus care.

---

## 🏛️ System Features & Workflows

### 1. Demonstrator Console (Roster Master — Yasith)
- **Flexible 7-Day Planning Studio**: Plan the week ahead starting from **any chosen date** (not locked to Monday).
- **1-Click Session Duplication**: Instant duplicate from Morning (`09:00 - 12:00`) to Afternoon (`13:00 - 16:00`) and vice-versa.
- **Full-Day Checkbox**: Single-click booking for both morning and afternoon duty blocks.
- **Sunday Evening CCS Batch**: Special time slot (`16:30 - 17:30`) automatically attached whenever Sunday falls in the 7-day range.
- **Night Duty 7-Day Rotation**: Ensures every single night of the week has a designated caretaker officer.
- **Collision & Leave Precedence Engine**: Mathematically blocks double-booking and prevents assigning duties to instructors with approved leave.
- **Cadre Workload Balancer**: Live meter tracking total teaching sessions and night shifts per instructor to guarantee equitable distribution.

### 2. Executive Operational Cockpit (Dr. Thisara)
- **Live Daily Readiness**: 3-bucket situational breakdown:
  - 🟢 **On Duty (Teaching)**: Current active lectures, batches, and lab locations.
  - 🟡 **Available / Free Standby**: Mathematically calculated idle pool available for student queries, marking, or emergency coverage.
  - 🔴 **On Leave**: Approved absences and reasons.
- **Entire Week Master Schedule**: Full 7-day timetable view with instructor filter, search by module/batch/lab, and one-click printable academic timetable.
- **Overnight Callout**: Immediate contact card for tonight's night duty officer.
- **Dual Leave Sign-Off**: Direct approval/decline authority for pending holiday applications.

### 3. Unified Instructor Portal
- Shared team account (`instructors@nibm.lk`) eliminating individual credential overhead.
- Quick filter by instructor name to view personal teaching assignments, lab venues, and upcoming night duties.
- Transparent holiday application submission with live status tracking (`PENDING`, `APPROVED`, `REJECTED`).

### 4. Public Live Status Board (No Login Required)
- Zero-authentication view accessible directly from the login screen.
- Ultra-clean, read-only display for campus lobby displays and staff room monitors showing who is working, free, on leave, and on night shift.

---

## 🔑 Default Accounts & Access

| Role | Email | Password | Access Highlights |
| :--- | :--- | :---: | :--- |
| **Public Board** | *No Login* | *None* | Read-only live operational status board |
| **Demonstrator (Roster Master)** | `yasith@nibm.lk` | `123` | Sunday Planning Studio, 1-Click Duplicate, Workload Balancer, Publishing |
| **Executive (Dr. Thisara)** | `thisara@nibm.lk` | `123` | Daily Cockpit, Entire Week Master Schedule, Free Pool, Leave Sign-Off |
| **Instructor Cadre** | `instructors@nibm.lk` | `123` | Shared Portal: Personal schedule, Leave application, Peer transparency |

---

## 🛠️ Technology Stack

- **Framework**: Next.js 16 (App Router, Turbopack, Server Actions)
- **UI & Styling**: React 19, Tailwind CSS v4, Lucide React Icons
- **Database**: PostgreSQL (Neon Serverless) via Prisma ORM 6.19
- **Resilience**: Zero-config persistent JSON fallback store for instant local operation out-of-the-box
- **Language**: TypeScript 5 (Strict Mode)

---

## 🚀 Getting Started

### Prerequisites
- Node.js 18.18+ or 20+
- npm or pnpm

### Installation

```bash
# Clone the repository
git clone https://github.com/Yasiyaa/NIBM-Instructor-Roster.git
cd NIBM-Instructor-Roster

# Install dependencies
npm install

# Run the development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Connecting to Cloud Database (Neon PostgreSQL)

1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```
2. Paste your Neon PostgreSQL connection string into `.env`.
3. Push the Prisma schema:
   ```bash
   npx prisma db push
   ```

---

## 🧪 Automated Tests

Run the domain rules verification test suite:

```bash
npx tsx scripts/verify-domain-rules.ts
```

Verifies 12 critical business invariants including collision blocking, leave precedence, mathematical free pool calculation, and night duty assignment constraints.

---

## 📄 License

Internal departmental software developed for NIBM School of Computing.
