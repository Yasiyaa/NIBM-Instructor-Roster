# Claude Code Guide for NIBM Instructor Roster System

@AGENTS.md
@CONTEXT_ANCHOR.md

## Primary Directive
You are pair programming on the **NIBM Instructor Roster System** (School of Computing, National Institute of Business Management).
Read and strictly adhere to the architecture, database constraints, cadre invariants, and security rules outlined in `CONTEXT_ANCHOR.md`.

## Core Invariants to Always Enforce:
1. **Teaching Cadre Count**: Strictly 9 members (3 Demonstrators: Yasith, Kithnuka & Sandali; 6 Technical Instructors).
2. **Free Standby Formula**: $\text{FreeStandby} = 9 - (\text{OnDuty} + \text{OnLeave})$.
3. **Collision & Leave Precedence**: No overlapping duty times per instructor or room; zero duty or night shifts allowed on approved leave.
4. **Neon Connection Pooling**: All Prisma connections to Neon must include `&pgbouncer=true`.
5. **Quality Standard**: Zero ESLint warnings (`npm run lint`), passing automated test suite (`npm test`), clean Next.js build (`npm run build`).
