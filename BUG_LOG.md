# Machliphon — Bug Log

Tracks bugs, security issues, and feature gaps found during QA & security audits.
Updated: 2026-04-24

Legend: 🔴 Open · 🟡 In Progress · ✅ Fixed · 🔵 Deferred (no real DB yet)

---

## Critical Bugs

| ID | Severity | Area | Description | Status | Fixed In |
|----|----------|------|-------------|--------|----------|
| B-001 | CRITICAL | Security/Backend | **Broken Access Control** — Any authenticated user could mark ANY assignment as 'arrived' (no ownership check on `PATCH /assignments/:id/arrive`) | ✅ Fixed | Security Agent — Auth scope added |
| B-002 | CRITICAL | Security/Backend | **Broken Access Control** — Any manager could complete ANY authority's assignments (`PATCH /assignments/:id/complete` missing authority_id scope) | ✅ Fixed | Security Agent — Authority scope added |
| B-003 | CRITICAL | Security/Backend | **Broken Access Control** — Any manager could cancel ANY authority's assignments (`DELETE /assignments/:id` missing authority_id scope) | ✅ Fixed | Security Agent — Authority scope added |
| B-004 | CRITICAL | Security/Backend | **Broken Access Control** — Manager could create assignment for foreign authority's kindergarten (`POST /assignments` missing authority check) | ✅ Fixed | Security Agent — kgAuthCheck added |
| B-005 | CRITICAL | Frontend | **CSV export always 401** — ReportsPage used `window.open()` to download CSV, which doesn't send Authorization header | ✅ Fixed | Sprint 1 — Replaced with Blob download |
| B-006 | CRITICAL | Frontend | **AbsencesPage completely disconnected from API** — Uses hardcoded mock data, never calls backend | 🔵 Deferred | Pending real DB connection |
| B-007 | CRITICAL | Frontend | **DashboardPage ignores real API** — Uses MOCK_ASSIGNMENTS/MOCK_KINDERGARTENS, overwrites API response | 🔵 Deferred | Pending real DB connection |
| B-008 | CRITICAL | Frontend | **SubstituteDashboard calendar uses mock data** — Real assignments never fetched for calendar view | 🔵 Deferred | Pending real DB connection |
| B-009 | CRITICAL | Frontend | **ProfilePage save is a no-op** — `handleSave()` shows toast but never calls API, changes lost on refresh | ✅ Fixed | Sprint 1 — PATCH /auth/me wired |
| B-010 | CRITICAL | Frontend | **Substitute availability toggle never persists** — `toggleAvailability()` mutates local state only, never calls `PUT /api/substitutes/availability` | ✅ Fixed | Sprint 1 — API call wired |

---

## High Severity Bugs

| ID | Severity | Area | Description | Status | Fixed In |
|----|----------|------|-------------|--------|----------|
| B-011 | HIGH | Security/Backend | **CSV formula injection** — CSV export didn't sanitize cells starting with `=`, `+`, `-`, `@` (OWASP A03) | ✅ Fixed | Security Agent — `sanitizeCsvCell()` added |
| B-012 | HIGH | Security/Backend | **JWT tokens valid 7 days** — Access tokens expiry was too long (7d), allows stolen token misuse | ✅ Fixed | Security Agent — Shortened to 1h |
| B-013 | HIGH | Security/Backend | **Helmet CSP disabled** — `contentSecurityPolicy: false` left XSS mitigations off | ✅ Fixed | Security Agent — Default CSP re-enabled |
| B-014 | HIGH | Security/Backend | **JSON body limit 10MB** — Oversized bodies could cause DoS | ✅ Fixed | Security Agent — Reduced to 100KB |
| B-015 | HIGH | Frontend | **SubstituteDashboard assignments use mock data** — Upcoming assignments calendar never reflects reality | 🔵 Deferred | Pending real DB connection |
| B-016 | HIGH | Frontend | **No error states in useQuery** — On API failure, pages show blank without feedback to user | ✅ Fixed | Sprint 1 — Error states added to all queries |

---

## Medium Severity Bugs

| ID | Severity | Area | Description | Status | Fixed In |
|----|----------|------|-------------|--------|----------|
| B-017 | MEDIUM | TypeScript | **asyncHandler type mismatch** — `AuthRequest` handlers passed where `Request` handlers expected; strict mode violation | ✅ Fixed | Sprint 1 — asyncHandler made generic |
| B-018 | MEDIUM | TypeScript | **Zod 3.25.x incompatible with `moduleResolution: node`** — `.d.cts` types not found by classic Node resolver | ✅ Fixed | Sprint 1 — Pinned zod to 3.22.4 |
| B-019 | MEDIUM | Backend | **Missing logout endpoint** — No server-side token invalidation | ✅ Fixed | Security Agent — POST /auth/logout added |
| B-020 | MEDIUM | Backend | **Manager-kindergarten scoping missing on absences** — Managers could see/create absences outside their assigned kindergartens | ✅ Fixed | Sprint 1 — manager_kindergartens join added |
| B-021 | MEDIUM | Backend | **No substitute reject endpoint** — Only approve existed; no way to reject pending\_approval substitutes with a reason | ✅ Fixed | Sprint 1 — PATCH /substitutes/:id/reject added |
| B-022 | MEDIUM | Backend | **Assignments on Israeli holidays not blocked** — No validation against holidays when creating an assignment | ✅ Fixed | Sprint 1 — Holiday check added |
| B-023 | MEDIUM | Backend | **Absence status not updated to 'covered' on arrival** — When substitute marked as arrived, related absence_report.status remained 'assigned' | ✅ Fixed | Sprint 1 — Auto-update on arrive |

---

## Low Severity / NIT

| ID | Severity | Area | Description | Status | Fixed In |
|----|----------|------|-------------|--------|----------|
| B-024 | LOW | Backend | **jwt.TokenExpiredError check unreachable** — Dead code in `middleware/auth.ts`: TokenExpiredError IS-A JsonWebTokenError, second instanceof branch never runs | 🟡 In Progress | Will fix in cleanup |
| B-025 | LOW | Frontend | **DashboardPage fetches /kindergartens but result unused** — wastes a network call | 🔵 Deferred | With mock data removal |
| B-026 | LOW | Frontend | **`super_admin` authorityId typed too wide** — `req.query.authorityId` is `string | ParsedQs | ...` not narrowed before use in SQL | 🔵 Deferred | Low risk — SQL parameterized |
| B-027 | LOW | Security | **GET /health leaks internal config** — Exposes `NODE_ENV`, presence of DB URL, JWT secret status | 🟡 In Progress | Restrict to internal only |
| B-028 | LOW | Security | **No account lockout after N failed logins** — Rate limiting (20/15min) partially mitigates but not sufficient | 🔵 Deferred | Post-MVP hardening |
| B-029 | LOW | Security | **No DB-backed refresh token blacklist** — Stolen refresh token is valid for 30 days with no revocation path | 🔵 Deferred | Post-MVP hardening |

---

## Feature Gaps (discovered during QA)

| ID | Feature | Priority | Status | Notes |
|----|---------|----------|--------|-------|
| F-001 | Substitute approve/reject with reason + UI | P0 | ✅ Fixed Sprint 1 | Reject endpoint + modal added |
| F-002 | Known absences (planned leaves) CRUD | P1 | ✅ Fixed Sprint 1 | `/api/known-absences` + KnownAbsencesPage |
| F-003 | Availability calendar UI | P1 | ✅ Fixed Sprint 1 | AvailabilityPage.tsx |
| F-004 | Smart substitute matching on absence creation | P1 | ✅ Fixed Sprint 1 | Shows available subs for date |
| F-005 | Substitute two-way cancellation | P1 | ✅ Fixed Sprint 1 | Sub can cancel with reason |
| F-006 | Post-assignment rating by manager | P2 | ✅ Fixed Sprint 1 | Rating modal on complete |
| F-007 | Manager-to-kindergarten mapping UI | P1 | ✅ Fixed Sprint 1 | KindergartenMappingPage |
| F-008 | Work permit renewal UI | P1 | ✅ Fixed Sprint 1 | Permit dialog in SubstitutesPage |
| F-009 | Password reset flow | P1 | ✅ Fixed Sprint 1 | /forgot-password + /reset-password |
| F-010 | Notification type filtering | P2 | ✅ Fixed Sprint 1 | Type filter added to notifications |
| F-011 | Error states in all useQuery hooks | P1 | ✅ Fixed Sprint 1 | Alert components on error |
| F-012 | Holiday validation on assignment creation | P2 | ✅ Fixed Sprint 1 | Backend + frontend warning |
| F-013 | Substitute earnings history | P2 | ✅ Fixed Sprint 1 | Earnings section in SubstituteDashboard |
| F-014 | Unassigned absence escalation to admin | P2 | ✅ Fixed Sprint 1 | Notification sent at creation |

---

## Security Audit Summary (OWASP Top 10)

| Category | Status | Notes |
|----------|--------|-------|
| A01 Broken Access Control | ✅ Fixed | 4 authority-scope checks added |
| A02 Cryptographic Failures | ✅ Pass | bcrypt 12 rounds, JWT 1h |
| A03 Injection | ✅ Fixed | All SQL parameterized; CSV formula injection patched |
| A04 Insecure Design | 🟡 Partial | No rate-limit per user, no lockout |
| A05 Security Misconfiguration | ✅ Fixed | CSP re-enabled, body limit reduced |
| A06 Vulnerable Components | 🟡 Partial | npm audit shows 5 warnings (mild) |
| A07 Auth Failures | 🟡 Partial | JWT 1h ✅, logout ✅, no token blacklist ⚠️ |
| A08 Software Integrity | 🔵 N/A | No supply chain checks configured |
| A09 Logging Failures | 🟡 Partial | morgan + requestId logs but no SIEM |
| A10 SSRF | ✅ N/A | No server-side URL fetching |

---

*This log is maintained manually. Update when fixing bugs or discovering new issues.*
