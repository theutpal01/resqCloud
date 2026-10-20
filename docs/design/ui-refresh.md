# Frontend refresh

Updated on October 6, 2026.

## Interface

- Dark navigation rail, clearer page hierarchy, shared spacing and color tokens, and consistent cards, tables, and form controls.
- Sign-in appears first on mobile. Citizen registration uses a Radix dialog; public reporting and tracking remain available without an account.
- Mobile navigation traps focus, closes with Escape, restores focus to its trigger, and dismisses after navigation.
- Incident filters remain readable on small screens. The incident table has a named, keyboard-focusable scroll region, and an empty filtered queue offers a clear-filters action.
- Session restoration keeps the sign-in layout in place and disables its controls until the session check finishes, avoiding a loading-panel layout shift.
- The signed-in overview now opens with a role-scoped situation brief: critical count, open count, report total, and a direct action into the priority queue.
- A field-operations editorial palette replaces the generic blue dashboard treatment with warm paper surfaces, ink navigation, and signal-orange priority. Noto Sans and Noto Serif are self-hosted for consistent, network-independent typography.

## Structure

`apps/web/app` contains route entry points and self-hosted fonts. Feature code lives under `apps/web/features`, grouped into authentication, incidents, dashboard, workspace, administration, notifications, responders, and profile. The situation brief is a dashboard-owned component; the former combined workspace panels are separate feature components.

`components/ui` contains reusable primitives and loading/empty states; `components/providers` contains the shared authentication provider. Shared components do not import feature code. The workspace shell owns responsive navigation, and `features/workspace/sections.ts` centralizes route titles, descriptions, and route validation.

`styles/tokens.css` owns design tokens. Base, layout, and component styles are imported through `app/globals.css` with explicit CSS layers. Forms and less frequently used management panels load on demand using the existing Next.js dynamic-import support. No dependencies were added.

## Verification

| Check                                                                        | Result           |
| ---------------------------------------------------------------------------- | ---------------- |
| Production API and web build                                                 | Passed           |
| TypeScript                                                                   | Passed           |
| ESLint, including accessibility rules                                        | Passed           |
| Formatting for changed source files                                          | Passed           |
| API/domain tests                                                             | 15 passed        |
| Browser tests against production build                                       | 4 passed         |
| axe scans: sign-in, registration, drawer, tracking, desktop/mobile dashboard | Zero violations  |
| Narrow-screen tracking with 200% text sizing                                 | No page overflow |

Browser tests used a separate SQLite database and temporary servers on ports 3100/4100. API requests were redirected to that isolated server; WebSocket connections were disabled to exercise the polling fallback. These checks do not validate live WebSocket delivery or external cloud integrations.

The contributor instructions in `AGENTS.md`, the generated `apps/web/AGENTS.md`, and the supplied `docs/PROJECT_IMPLEMENTATION.md` are excluded from Prettier because they are instruction/source documents rather than maintained application code. The Impeccable hook cache is excluded as generated local state. `npm run lint` passed after this cleanup.

### Mobile Lighthouse

The unauthenticated entry page was measured against `next build` / `next start`, using Lighthouse 13.5.0 with default mobile throttling and Chromium.

| Metric                   | First audit | Final audit |
| ------------------------ | ----------- | ----------- |
| Performance              | 85          | 97          |
| Accessibility            | 100         | 100         |
| Largest contentful paint | 2.6 s       | 2.495 s     |
| Cumulative layout shift  | 0.227       | 0           |
| Total blocking time      | 100 ms      | 77 ms       |

These are local lab measurements, not production field data. INP was not measured; total blocking time is the lab responsiveness metric. The final raw reports are available for this workspace session at `/tmp/resq-ui-lighthouse.report.html` and `/tmp/resq-ui-lighthouse.report.json`.

### October 6 dashboard refresh

| Check                                               | Result                                             |
| --------------------------------------------------- | -------------------------------------------------- |
| Web production build                                | Passed                                             |
| TypeScript and targeted ESLint/Prettier checks      | Passed                                             |
| Browser navigation, keyboard drawer, and axe checks | 2 passed; zero reported axe violations             |
| Authenticated dashboard browser flow                | Not rerun; the isolated API server was not started |

## Previews

- [Sign-in](./screenshots/sign-in-desktop.png)
- [Desktop dashboard](./screenshots/dashboard-desktop.png)
- [Mobile dashboard](./screenshots/dashboard-mobile.png)
