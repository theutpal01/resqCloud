<!-- frontend-standard-skills:angular START — do not edit between these markers, regenerate with `npx frontend-standard-skills add angular` -->

# Frontend Contributor Rules — Angular

Applies to every change under `src/app/` in this Angular (standalone components, v17+) project. Self-contained — includes the framework-agnostic baseline plus Angular-specific practice.

## 1. Component & change-detection model

- **Standalone components only** for new code — no `NgModule`. Every component/directive/pipe declares `standalone: true` and imports exactly what its template needs.
- **`ChangeDetectionStrategy.OnPush` on every component**, as the default, not an opt-in. Treat a component left on default detection without a stated reason as a should-fix.
- **Signals (`signal()`, `computed()`, `effect()`)** for synchronous local/derived state. **RxJS `Observable`** for async streams (HTTP, websockets, events with operators like `debounceTime`/`switchMap`). Bridge with `toSignal()`/`toObservable()` when needed.
- Built-in control flow (`@if`, `@for` with `track`, `@switch`) in templates — not `*ngIf`/`*ngFor` structural directives.
- Treat `@Input()` values as immutable — mutating an input in place silently breaks `OnPush`'s reference-equality check.

## 2. Accessibility (WCAG 2.1 AA)

- Real semantic HTML in templates (`<button>`, `<nav>`, `<main>`, real `<label for>` + `<input>`) — no `<div (click)>`.
- Use `@angular/cdk/a11y` for focus traps (`cdkTrapFocus`) and dynamic announcements (`LiveAnnouncer`) — don't hand-roll either.
- Every `<img ngSrc>` (always `NgOptimizedImage`, never a bare `<img src>` without a specific reason) has descriptive, context-specific `alt`, or `alt=""` if decorative.
- Custom modals implement `role="dialog"` + `aria-modal` + `cdkTrapFocus` + `Escape`-to-close + focus restore on close — prefer Angular CDK/Material `Dialog` over hand-rolling.
- Reactive form fields: real `<label for>`, errors associated via `aria-describedby` + `aria-invalid`, driven off `FormControl` state — not just a CSS class toggle.
- On route change, move focus to the new view's heading or a `<main tabindex="-1">` — `Router` navigation doesn't move focus automatically.
- Keep `@angular-eslint/template/accessibility` enabled and build-breaking in CI.
- Color contrast ≥ 4.5:1 body / ≥ 3:1 large text; never convey state by color alone; respect `prefers-reduced-motion`; text sizing in `rem`/`em`.

## 3. Core Web Vitals (target: LCP < 2.5s · CLS < 0.1 · INP < 200ms, per https://pagespeed.web.dev/)

- `NgOptimizedImage` (`ngSrc`) for every content image; `priority` on the actual LCP image only; explicit `width`/`height` or `fill` inside a sized parent always (compile-time enforced).
- `@defer` blocks for non-critical template sections, with a trigger matched to intent (`on viewport`, `on idle`, `on interaction`) and a correctly-sized `@placeholder` so the swap-in doesn't shift layout.
- `loadComponent` for route-level code splitting — no eagerly-imported routes for anything not needed on first paint.
- `OnPush` + signals to minimize change-detection cost on every interaction; run high-frequency non-UI work outside Angular's zone (`NgZone.runOutsideAngular`).
- Prefer SSR/prerendering over client-rendered-only shells for content known at request/build time — TTFB gates LCP.
- Measure against a real `ng build` output, never `ng serve`. Keep `angular.json` bundle budgets tight and treat `maximumError` as a real build-breaking gate, not something to raise on demand.

## 4. Component & file conventions

- Folder structure: `core/` (app-wide singletons), `shared/` (reusable, feature-agnostic), `features/<feature>/` (feature-owned). Dependency direction: `features → shared`, never the reverse.
- **File naming — Angular's exception to the general camelCase-file rule**: every file is `kebab-case` with a type suffix (`user-profile.component.ts`, `auth.service.ts`, `auth.guard.ts`, `order.model.ts`). Generate with `ng generate` to keep this automatic.
- `strict: true` TypeScript, no `any` — including in templates (`strictTemplates` is on; don't silence its errors with `any`). Reactive forms are typed (`FormControl<string>`), never `UntypedFormControl` for new code.
- **`inject()`** over constructor injection for new standalone components/services/guards. **`providedIn: 'root'`** for app-wide singleton services.
- DRY: markup/logic/values repeated 3+ times get extracted to a shared component, pipe, directive, or design token — not copy-pasted.

## 5. UX consistency

- Every async view (HTTP call, route resolver, deferred block) has a loading state, an empty state, and an error state — `@defer`'s `@loading`/`@error` blocks or an explicit signal-driven state machine, never a silent gap.
- Mobile-first CSS, ≥ 44×44px touch targets, immediate (~100ms) feedback on every interactive action.

## 6. Tooling & CI (build-breaking gates)

- `ng lint` (`angular-eslint` + `@angular-eslint/template/accessibility`) and Prettier on every commit/CI run.
- `TestBed` for services/guards/interceptors/pipes; `@testing-library/angular` for component tests (query by role/label, not implementation detail). Playwright or Cypress (+ `@axe-core/playwright`/`cypress-axe`) for e2e and accessibility on critical paths.
- Lighthouse CI against a real `ng build` output served statically, with LCP/CLS/performance-score budgets as `error`-level assertions.
- `angular.json` bundle budgets (`maximumWarning`/`maximumError`) configured on every project; a new dependency that trips `maximumError` needs a deliberate justification, not a raised threshold.
- `README.md` updated in the same PR whenever setup, env vars, scripts, or folder conventions change.

## 7. Before opening a PR

- [ ] Every new component has `changeDetection: ChangeDetectionStrategy.OnPush` (or a stated reason it doesn't).
- [ ] No manual `.subscribe()` without `takeUntilDestroyed()` or `AsyncPipe`.
- [ ] Keyboard-only walkthrough of the changed flow; zero new `@angular-eslint/template/accessibility`/axe violations.
- [ ] New images use `NgOptimizedImage` with dimensions and descriptive `alt`; LCP image has `priority`.
- [ ] Non-critical template sections wrapped in `@defer` with a correctly-sized `@placeholder`.
- [ ] No hardcoded design value duplicating an existing token; no logic duplicated 3+ times.
- [ ] `ng build` bundle budgets checked for unexpected growth; PageSpeed checked if images/fonts/scripts/data-fetching changed.
- [ ] README updated if setup/config/scripts changed.

<!-- frontend-standard-skills:angular END -->

<!-- frontend-standard-skills:astro START — do not edit between these markers, regenerate with `npx frontend-standard-skills add astro` -->

# Frontend Contributor Rules — Astro

Applies to every change under `src/pages/`, `src/components/`, `src/layouts/`, `src/content/`, and related directories in this Astro project. Self-contained — includes the framework-agnostic baseline plus Astro-specific practice.

## 1. Rendering model — zero JS by default

- Astro components render to static HTML with **no client-side JavaScript** unless explicitly hydrated. Start from that baseline for every component — don't add a `client:` directive unless the component genuinely needs to run JS in the browser.
- Use Content Collections (`src/content/`, typed via `src/content/config.ts`) for structured, build-time content instead of client-side data fetching — avoids fetch waterfalls on content-driven pages.
- Use `astro:transitions` (`<ClientRouter />`) for fast navigations between static pages instead of adopting a full SPA framework runtime purely for transition animations.

## 2. Selective hydration (`client:` directives)

- Use the **least-eager** directive that still works: `client:visible`/`client:idle` for below-the-fold or non-urgent interactive components; `client:load` only for above-the-fold components that must be interactive immediately; `client:media` for viewport-conditional islands; `client:only` sparingly, since it forfeits server-rendering entirely.
- Keep islands **small and leaf-level** — hydrate the specific interactive piece (a button, a form, a toggle), not the section of the page around it. This is the Astro-specific version of "push `use client` down the tree," and it matters more here since the baseline is zero JS, not just fewer boundaries.
- Every `client:` directive added in a PR has a specific, stated reason for both its presence and its chosen eagerness level.

## 3. Accessibility (WCAG 2.1 AA)

- Real semantic HTML in every `.astro` template (`<button>`, `<nav>`, `<main>`, real `<label for>` + `<input>`) — this is nearly all of the page, since most of an Astro site is static markup. No "div soup."
- Every `<Image>`/`<Picture>` (from `astro:assets`) has descriptive, context-specific `alt` text, or `alt=""` if decorative — dimension enforcement is automatic, `alt` is not.
- Interactive components hydrated as React/Vue/Svelte islands follow **that framework's** accessibility rules (focus trap, ARIA wiring, keyboard patterns) — an island's accessibility is owned by the framework it's written in, not blanket Astro rules.
- After every `astro:transitions` navigation, move focus to `<main>` or the new page's heading; mark the active nav link with `aria-current="page"`, never color alone.
- Keep `eslint-plugin-astro` enabled and build-breaking in CI; layer in `eslint-plugin-jsx-a11y`/Vue/Svelte a11y linters for whichever island frameworks are in use.
- Color contrast ≥ 4.5:1 body / ≥ 3:1 large text; never convey state by color alone; respect `prefers-reduced-motion`; text sizing in `rem`/`em`.

## 4. Core Web Vitals (target: LCP < 2.5s · CLS < 0.1 · INP < 200ms · Lighthouse Performance ≥ 90 mobile)

- `<Image>`/`<Picture>` from `astro:assets` for every local, processable image; explicit `width`/`height` always; the LCP image is not lazy-loaded, everything else is.
- Content Collections (or build-time `fetch`) for content known at build time — no client-side fetch waterfall for above-the-fold, content-driven data.
- Choose `client:` directives per the eagerness rule in section 2 — this is the primary INP/bundle-size lever in an Astro project.
- Measure against `astro build && astro preview`, never `astro dev`. Watch the build output for unexpected client-JS growth after adding or changing a `client:` directive or a new UI framework dependency.

## 5. Component & file conventions

- File-based routing: `src/pages/<route>.astro` (or `.md`/`.mdx`), `kebab-case` matching the URL. Component files: `PascalCase.astro`. Content Collection entries: `kebab-case.md`/`.mdx` matching the slug. Everything else (`lib/`, utilities): `camelCase.ts`.
- Every `.astro` component types its props via a `Props` interface in the component frontmatter script; framework islands type props per that framework's own convention.
- Shared, feature-agnostic components live in `components/ui/`; feature-only components live beside the feature/page. Shared components never import feature-specific code.
- Mixing UI frameworks (React/Vue/Svelte islands in one project) is allowed but must be a deliberate, documented choice (state the primary framework in the README; justify any additional framework in the PR) — never incidental sprawl. Avoid two different framework islands on the same page.
- DRY: markup/logic/values repeated 3+ times get extracted to a shared component, utility, or design token — not copy-pasted.

## 6. UX consistency

- Every async view (an island fetching client-side, a form submission) implements loading, empty, and error states — never just the happy path.
- Mobile-first CSS, ≥ 44×44px touch targets, immediate (~100ms) feedback on every interactive action.

## 7. Tooling & CI (build-breaking gates)

- `eslint-plugin-astro` (+ the a11y linter matching each island framework in use) and `prettier-plugin-astro` on every commit/CI run.
- `astro check` in CI — catches `.astro`-specific type errors (`Props` mismatches, Content Collection schema violations, slot errors) that plain `tsc` can't see.
- Vitest for utility/logic units; the matching framework's testing library for island component tests; Playwright (+ `@axe-core/playwright`) for e2e and accessibility on critical paths, including pages with client islands (hydration bugs are an Astro-specific failure mode).
- Lighthouse CI against a real `astro build && astro preview`, with LCP/CLS/performance-score budgets as `error`-level assertions.
- `web-vitals` wired via a small client script in the base layout, reporting to analytics for real-user field data.
- `README.md` updated in the same PR whenever setup, env vars, scripts, or folder conventions change.

## 8. Before opening a PR

- [ ] Every new `client:` directive has a specific, stated reason and uses the least-eager option that works.
- [ ] Keyboard-only walkthrough of the changed flow; zero new accessibility-linter/axe violations.
- [ ] New images use `astro:assets`' `<Image>`/`<Picture>` with dimensions and descriptive `alt`.
- [ ] New island components follow their framework's accessibility rules (React/Vue/Svelte skill in this collection), not generic Astro assumptions.
- [ ] `astro check` passes with no new errors.
- [ ] No hardcoded design value duplicating an existing token; no logic duplicated 3+ times.
- [ ] Build output checked for unexpected client-JS growth; PageSpeed checked if images/content-fetching/hydration changed.
- [ ] README updated if setup/config/scripts changed.

<!-- frontend-standard-skills:astro END -->

<!-- frontend-standard-skills:core-standards START — do not edit between these markers, regenerate with `npx frontend-standard-skills add core-standards` -->

# Frontend Contributor Rules — Core Standards

These rules apply to **every** frontend change in this repository, regardless of stack. Read this before writing or reviewing any component, page, or style change. If a stack-specific rules section (React, Next.js, Nuxt, Astro, Angular, Vue, Svelte) is also present in this file, it extends — never overrides — the rules below.

Source of truth / full detail: `frontend-standard-skills` → `core-standards` skill (`references/accessibility.md`, `references/visually-impaired-support.md`, `references/performance-core-web-vitals.md`, `references/performance-testing-ci.md`, `references/component-design.md`, `references/code-quality-style.md`, `references/ux-consistency.md`).

## 1. Accessibility (WCAG 2.1 AA — mandatory)

- Use semantic HTML (`button`, `a`, `nav`, `header`, `main`, `ul`/`li`, real `label`+`input`) before reaching for `<div>`/`<span>` + ARIA. No "div soup."
- Every interactive element is keyboard operable (`Tab` to focus, `Enter`/`Space` to activate) with a **visible** focus indicator. Never `outline: none` without an equal-or-better `:focus-visible` replacement.
- Icon-only controls get `aria-label`. Decorative icons/images get `aria-hidden="true"` / `alt=""`.
- Dynamic updates (toasts, async results, validation errors) are announced via `aria-live` or `role="alert"`.
- Modals: `role="dialog"` + `aria-modal="true"` + `aria-labelledby`, trap focus while open, restore focus to trigger on close, close on `Escape`.
- Forms: every field has a real associated `<label>` (never placeholder-only). Errors use `aria-invalid` + `aria-describedby`, are announced, and explain how to fix the problem.
- Color contrast: body text ≥ 4.5:1, large text ≥ 3:1, meaningful non-text UI ≥ 3:1. Verify, don't guess.
- Run an automated accessibility check (axe / Lighthouse / `eslint-plugin-jsx-a11y` or framework equivalent) with zero new violations before opening a PR.

## 2. Visually impaired / screen-reader support

- Alt text is descriptive and specific to context — never `alt="image"` or a filename. Empty `alt=""` only for genuinely decorative images.
- DOM order matches intended reading order; don't use CSS to visually reorder content away from its DOM/announcement order.
- Never convey meaning (status, error, required, selected) through color alone — pair it with text, an icon, or a pattern.
- Typography and spacing that affects readability uses `rem`/`em`, not hardcoded `px`. Verify layouts survive 200% browser zoom.
- Respect `prefers-reduced-motion` for any non-essential animation/transition.
- For new, widely-reused flows, do a manual pass with VoiceOver or NVDA, not just automated tooling.

## 3. Core Web Vitals (measured against https://pagespeed.web.dev/)

Enforced thresholds: **LCP < 2.5s · CLS < 0.1 · INP < 200ms · Lighthouse Performance ≥ 90 (mobile).**

- **LCP**: preload the LCP resource (hero image/text), never lazy-load it, use `srcset`/modern image formats, minimize render-blocking `<head>` resources, defer/async non-critical JS.
- **CLS**: always set explicit `width`/`height` or `aspect-ratio` on images/embeds/iframes; reserve space for ads and dynamically injected banners; use `font-display: swap`; never insert content above what the user is currently viewing except in direct response to their own action; animate `transform`/`opacity`, not layout properties.
- **INP**: keep event handlers lean and give immediate visual feedback; break up long synchronous tasks; memoize to avoid unnecessary re-renders; scope state as locally as possible; debounce/throttle high-frequency handlers; defer non-urgent work (analytics, logging) off the interaction path.

## 4. Performance testing & CI

- Run https://pagespeed.web.dev/ (or `lighthouse` CLI) against staging before/after any change likely to affect performance.
- Wire the `web-vitals` package to real analytics for field-data monitoring (p75, not average).
- CI must run Lighthouse CI (or equivalent) on every PR against a real build, with LCP/CLS/performance-score budgets as **build-breaking** assertions, not warnings.
- Track bundle size; a new dependency that meaningfully grows the bundle needs a deliberate justification, not a silent merge.

## 5. Component design

- One responsibility per component. Prefer composition over a component with many boolean/config props.
- Shared/reusable components (`components/ui`, `components/shared`) never import feature-specific code; dependency direction is features → shared, never the reverse.
- Accessibility lives inside the shared component implementation, once — not repeated at every call site.
- TypeScript (where used): no `any`; explicit, exported prop/interface types; prefer discriminated unions over combinations of optional booleans.
- Avoid prop drilling (3+ levels) — use context/provide-inject/composables/store instead. Avoid state that's just a manually-synced derivation of other state — compute it during render instead.

## 6. UX, usability & consistency

- The same action always looks and behaves the same way everywhere (primary/destructive button semantics, confirmation patterns).
- Use a shared spacing scale and type scale via design tokens — no arbitrary one-off pixel values.
- Every async view implements **loading**, **empty**, and **error** states — never just the happy path. Loading states reserve the final layout's space (no CLS). Error states are specific and, where retryable, offer a retry action.
- Mobile-first CSS: base styles for the smallest viewport, `min-width` media queries layer up from there. Touch targets ≥ 44×44px.
- Every user action gets immediate (~100ms) visual feedback, even if the underlying operation takes longer.

## 7. Code quality, naming, and DRY

- **File naming**: `camelCase` (`formatDate.js`, `useDebounce.js`); component files may use `PascalCase` per the stack's convention — stay consistent within the project either way.
- **Variables/functions**: `camelCase`. **Components/types**: `PascalCase`. **True constants**: `UPPER_SNAKE_CASE`. Booleans prefixed `is`/`has`/`should`/`can`.
- **DRY**: if the same logic/markup/value appears 3+ times, extract it into a shared component, utility, hook, or design token. Design tokens (color, spacing, type, radius, shadow) live in one place, referenced everywhere — never hardcoded.
- Split any component/file that's grown past ~200-300 lines or that's doing more than one cohesive thing, into named, clearly-scoped pieces.
- Organize by feature/domain with a distinct `shared`/`components` layer for cross-cutting reusable UI.
- Comments explain **why**, not what the code already says. Every shared component and non-trivial utility gets a short doc comment.
- **Update `README.md` in the same PR** whenever setup steps, env vars, scripts, or folder conventions change.
- Linter + formatter run on every commit/CI run as a build-breaking gate, including accessibility linting.

## 8. Before opening a PR — self-check

- [ ] Keyboard-only walkthrough works end to end for the changed flow.
- [ ] No new automated accessibility violations (axe/Lighthouse/lint).
- [ ] Images/embeds have explicit dimensions; nothing shifts on load.
- [ ] Loading, empty, and error states are all implemented for new async UI.
- [ ] No hardcoded design values that duplicate an existing token.
- [ ] No logic/markup duplicated 3+ times that should be shared.
- [ ] README updated if setup/config/scripts changed.
- [ ] Lighthouse/PageSpeed checked locally if the change touches images, fonts, third-party scripts, or client-side data fetching.

<!-- frontend-standard-skills:core-standards END -->

<!-- frontend-standard-skills:html-css START — do not edit between these markers, regenerate with `npx frontend-standard-skills add html-css` -->

# Frontend Contributor Rules — HTML & CSS

Applies to every `.html`/`.css`/vanilla-JS change in this project. These rules are self-contained (they include the framework-agnostic baseline plus HTML/CSS-specific practice) — no separate skill install required, though pairing with `core-standards` adds more depth.

## 1. Accessibility (WCAG 2.1 AA)

- Real HTML structure: `<header>`, `<nav>`, `<main>`, `<footer>`, `<button>`, `<a href>`, real `<label>`+`<input>`. No `<div onclick>` posing as a control.
- Include a visually-hidden **skip link** to `#main` as the first focusable element on every page.
- Exactly one `<h1>`; headings in strict logical order — change size with CSS, not heading level.
- Every interactive element keyboard-operable with a visible `:focus-visible` state (never bare `outline: none`).
- Icon-only buttons get `aria-label`; decorative images get `alt=""`; informative images get specific, descriptive `alt` text — never a filename or "image."
- Custom modals: `role="dialog"` + `aria-modal="true"` + `aria-labelledby`, trap focus, restore focus on close, close on `Escape`, make background `inert` while open.
- Forms: real associated `<label>`, `required`/`type="email"` etc. as first-line validation, errors linked via `aria-describedby` + `aria-invalid`, announced via `role="alert"`.
- Never convey status/error/required by color alone. Color contrast ≥ 4.5:1 body text, ≥ 3:1 large text/meaningful UI.
- Respect `prefers-reduced-motion`; use `rem`/`em` for text sizing so the page respects browser zoom/text-size settings.

## 2. Core Web Vitals (target: LCP < 2.5s · CLS < 0.1 · INP < 200ms, per https://pagespeed.web.dev/)

- Preload the LCP image (`<link rel="preload" as="image" fetchpriority="high">`); never `loading="lazy"` on it.
- Explicit `width`/`height` (or `aspect-ratio`) on every `<img>`/`<iframe>`; reserve space for ads/banners; never insert content above the current viewport unprompted.
- Inline critical above-the-fold CSS; load non-critical CSS non-blocking; `defer`/`async` any non-essential `<script>`.
- Self-host or `preconnect` web fonts; always `font-display: swap`.
- Serve `.webp`/`.avif`, correctly sized, through a CDN with cache-busted filenames.
- Debounce high-frequency vanilla-JS listeners (`input`, `scroll`, `resize`); keep event handlers lean, defer non-urgent work off the interaction path.

## 3. CSS architecture & DRY

- Pick one convention — BEM (`.block__element--modifier`) or utility-first — and apply it consistently across the whole codebase; don't mix.
- Design tokens (color, spacing, type scale, radius, shadow) live once in `styles/tokens.css` as CSS custom properties, referenced everywhere. No hardcoded hex codes or magic pixel values in component stylesheets.
- Use `@layer` to make cascade order explicit; avoid `!important` as a specificity workaround.
- Markup, CSS, or JS behavior repeated on 3+ pages gets extracted into a partial/include/template function or a shared module — never hand-copy-pasted.

## 4. File & folder conventions

```
styles/tokens.css, base.css, layout.css, components/<name>.css, utilities.css, main.css
scripts/main.js, modules/<behavior>.js
```
- CSS files/classes: `kebab-case`. JS files: `camelCase`. Styling hooks (classes) and behavior hooks (`js-` prefixed ids or `data-*` attributes) are kept separate so refactoring one doesn't silently break the other.
- One reusable UI pattern per `styles/components/*.css` file.

## 5. UX consistency

- Loading/empty/error states for any async (fetch-driven) content — never a silent blank area.
- Mobile-first CSS: base styles for the smallest viewport, `min-width` media queries layer up. Touch targets ≥ 44×44px.
- Immediate (~100ms) visual feedback on every interactive action.

## 6. Tooling & CI (build-breaking gates)

- `stylelint` + `htmlhint` (or ESLint for any JS) run in CI and pre-commit.
- `axe-core` (CLI or Playwright) with zero violations.
- Lighthouse CI against the deployed/preview URL with LCP/CLS/performance-score budgets as `error`-level assertions (see `references/testing-and-tooling.md`).
- `README.md` updated in the same PR whenever setup, build, or folder conventions change.

## 7. Before opening a PR

- [ ] Keyboard-only walkthrough of the changed page/flow.
- [ ] `stylelint`/`htmlhint`/`axe` all pass with zero new violations.
- [ ] New images have explicit dimensions and descriptive `alt` text.
- [ ] No hardcoded color/spacing value duplicating an existing token.
- [ ] PageSpeed Insights checked if the change touches images, fonts, or scripts.

<!-- frontend-standard-skills:html-css END -->

<!-- frontend-standard-skills:nextjs START — do not edit between these markers, regenerate with `npx frontend-standard-skills add nextjs` -->

# Frontend Contributor Rules — Next.js

Applies to every change under `app/`, `components/`, `lib/`, and related directories in this Next.js (App Router) project. Self-contained — includes the framework-agnostic baseline plus Next.js-specific practice.

## 1. Rendering model

- **Default to Server Components.** Add `"use client"` only when a component genuinely needs browser APIs, event handlers, React state/effects, or a client-only library — and push that boundary as far down the tree as possible (wrap the interactive leaf, not the whole page).
- Fetch data in Server Components / Route Handlers, close to where it's used. Avoid client-side `useEffect` fetch waterfalls for data available at request time.
- Be deliberate with `fetch` caching (`cache`, `next: { revalidate }`) — don't accidentally cache per-user data or leave cacheable data uncached.
- Use `<Suspense>` + streaming for slow, non-critical data so the rest of the page isn't blocked on the slowest fetch. Use `next/dynamic` to code-split heavy, non-critical Client Components.

## 2. Accessibility (WCAG 2.1 AA)

- Real semantic HTML inside JSX (`<button>`, `<nav>`, `<main>`, real `<label htmlFor>` + `<input>`) — no `<div onClick>`.
- Every `<Image>` (always `next/image`, never a bare `<img>` without a specific reason) has descriptive, context-specific `alt` text, or `alt=""` if decorative.
- Move focus to `<main>` (or the new heading) on client-side route transitions; mark the active nav link with `aria-current="page"`.
- Custom modals implement `role="dialog"` + `aria-modal` + focus trap + `Escape`-to-close + focus restore — prefer a maintained headless primitive (Radix UI, React Aria) over hand-rolling.
- Server Action forms: validate on the server (never trust client-only validation), surface errors via `aria-describedby`/`aria-invalid`/`role="alert"`, show a busy state (`aria-busy`) while `pending`.
- Keep `eslint-plugin-jsx-a11y` (bundled in `eslint-config-next`) enabled and build-breaking in CI.
- Color contrast ≥ 4.5:1 body / ≥ 3:1 large text; never convey state by color alone; respect `prefers-reduced-motion`; text sizing in `rem`/`em`.

## 3. Core Web Vitals (target: LCP < 2.5s · CLS < 0.1 · INP < 200ms, per https://pagespeed.web.dev/)

- `next/image` for every image; `priority` on the actual LCP image only (never lazy-loaded); explicit `width`/`height` or `fill` inside a sized parent always.
- `next/font` (Google or local) for all web fonts — never a manual `<link>` to an external font host.
- `next/script` with the correct `strategy` (`beforeInteractive`/`afterInteractive`/`lazyOnload`) for every third-party script.
- Minimize `"use client"` surface area to control hydration cost; memoize expensive client computations; scope client state locally; debounce high-frequency handlers.
- Prefer static generation or ISR (`revalidate`) over `force-dynamic` unless the route truly needs per-request data — TTFB gates LCP.
- Measure against `next build && next start`, never `next dev`. Watch the build's First Load JS table for regressions; use `@next/bundle-analyzer` when a dependency looks heavy.

## 4. Component & file conventions

- App Router structure: `app/<route>/page.tsx`, `layout.tsx`, `loading.tsx`, `error.tsx`, `not-found.tsx`; route groups `(name)/` for organization without affecting the URL.
- Route segment folders: `kebab-case`. Component files: `PascalCase.tsx`. Everything else (`lib/`, `hooks/`, utils): `camelCase.ts`.
- Shared, feature-agnostic components live in `components/ui/`; feature-only components live beside the feature/route. Shared components never import feature-specific code.
- `strict: true` TypeScript, no `any`; explicit prop types; Server Action inputs validated (e.g. with Zod), never trusted implicitly.
- DRY: markup/logic/values repeated 3+ times get extracted to a shared component, hook, or design token — not copy-pasted.

## 5. UX consistency

- `loading.tsx` and `error.tsx` present for every route with async data; loading UI approximates the loaded layout's dimensions (no CLS on swap-in); error UI is specific and offers retry where possible.
- Mobile-first CSS, ≥ 44×44px touch targets, immediate (~100ms) feedback on every interactive action.

## 6. Tooling & CI (build-breaking gates)

- `next lint` (with `next/core-web-vitals` + `eslint-plugin-jsx-a11y`) and Prettier on every commit/CI run.
- Vitest + React Testing Library for units/components (query by role/label, not implementation detail); Playwright (+ `@axe-core/playwright`) for e2e and accessibility on critical paths.
- Lighthouse CI against a real `next build && next start`, with LCP/CLS/performance-score budgets as `error`-level assertions.
- `web-vitals` (via `useReportWebVitals`) wired to analytics for real-user field data.
- `README.md` updated in the same PR whenever setup, env vars, scripts, or folder conventions change.

## 7. Before opening a PR

- [ ] Every new `"use client"` has a specific, stated reason.
- [ ] Keyboard-only walkthrough of the changed flow; zero new `jsx-a11y`/axe violations.
- [ ] New images use `next/image` with dimensions and descriptive `alt`; LCP image has `priority`.
- [ ] `loading.tsx`/`error.tsx` (or `<Suspense>`) cover new async UI.
- [ ] No hardcoded design value duplicating an existing token; no logic duplicated 3+ times.
- [ ] `next build` First Load JS checked for unexpected growth; PageSpeed checked if images/fonts/scripts/data-fetching changed.
- [ ] README updated if setup/config/scripts changed.

<!-- frontend-standard-skills:nextjs END -->

<!-- frontend-standard-skills:nuxt START — do not edit between these markers, regenerate with `npx frontend-standard-skills add nuxt` -->

# Frontend Contributor Rules — Nuxt

Applies to every change under `pages/`, `layouts/`, `components/`, `composables/`, `server/`, and related directories in this Nuxt (3/4) project. Self-contained — includes the framework-agnostic baseline plus Nuxt-specific practice.

## 1. Data fetching and rendering model

- Use `useFetch`/`useAsyncData` for anything needed on initial render — never a manual `fetch`/`axios` call inside `onMounted`, which loses SSR data, caching, and deduplication.
- Key `useAsyncData` calls deliberately; don't let an incidental value (e.g. a timestamp) bust caching/dedup by accident. Use `getCachedData` when SSR-payload reuse vs. refetch-on-navigation needs to differ.
- Set rendering mode per route via `routeRules` in `nuxt.config.ts` (`prerender`, `isr`, `ssr: false` for SPA-only routes) instead of forcing one global mode. Don't set `ssr: false` globally "to simplify" — it gives up SSR's LCP/SEO benefits app-wide for a problem usually scoped to one route.
- Use `server/api/` routes for endpoints your own client code or external services call; validate all inputs server-side (e.g. with `zod`) — never trust `readBody`/`getQuery` shape implicitly.

## 2. Accessibility (WCAG 2.1 AA)

- Real semantic HTML inside templates (`<button>`, `<nav>`, `<main>`, real `<label for>` + `<input>`) — no `<div @click>`.
- Every `<NuxtImg>`/`<NuxtPicture>` (always `@nuxt/image`, never a bare `<img>` without a specific reason) has descriptive, context-specific `alt` text, or `alt=""` if decorative.
- Move focus to `<main>` (or the new page's heading) on client-side route transitions; mark the active `<NuxtLink>` with `aria-current="page"` explicitly, not via active-class styling alone.
- Custom modals implement `role="dialog"` + `aria-modal` + focus trap + `Escape`-to-close + focus restore — prefer a maintained headless primitive (Radix Vue, Headless UI Vue) over hand-rolling.
- Forms: validate on the server (never trust client-only validation), surface errors via `aria-describedby`/`aria-invalid`/`role="alert"`, show a busy state (`aria-busy`) while pending. Critical flows (login, checkout) degrade gracefully without JS where feasible.
- Keep `eslint-plugin-vuejs-accessibility` (composed into `@nuxt/eslint`) enabled and build-breaking in CI.
- Color contrast ≥ 4.5:1 body / ≥ 3:1 large text; never convey state by color alone; respect `prefers-reduced-motion`; text sizing in `rem`/`em`.

## 3. Core Web Vitals (target: LCP < 2.5s · CLS < 0.1 · INP < 200ms, per https://pagespeed.web.dev/)

- `<NuxtImg>`/`<NuxtPicture>` for every image; `preload` on the actual LCP image only (never lazy-loaded); explicit `width`/`height` or `aspect-ratio` always.
- Choose the cheapest correct `routeRules` mode per route — prerendered/ISR over full SSR where content isn't per-request-dynamic; TTFB gates LCP.
- Lazy-hydrate non-critical components (`<LazyMyComponent />`, `hydrate-on-visible`/`hydrate-on-idle` where available in the installed Nuxt version) to control hydration cost.
- Memoize expensive `computed()` chains; scope reactive state locally; debounce high-frequency handlers (search input, scroll, resize).
- Measure against `nuxt build` + `nuxt preview`/`node .output/server/index.mjs`, never `nuxt dev`. Run `nuxi analyze` when a dependency looks heavy.

## 4. Component & file conventions

- File-based routing: `pages/<route>.vue` in `kebab-case` matching the URL; `layouts/`, `error.vue`, `app.vue` at the conventional locations.
- Component files: `PascalCase.vue` — the filename is also the auto-imported tag name; name files so the resulting tag is unambiguous (watch nested-folder tag prefixing).
- Composables: `useX.ts` in `composables/`, camelCase, auto-imported — no manual import needed.
- Shared, feature-agnostic components live in `components/ui/`; feature-only components live beside the feature/page. Shared components never import feature-specific code.
- `strict: true` TypeScript, no `any`; props typed via `defineProps<T>()`; `server/api/` inputs validated, never trusted implicitly.
- Shared state across routes/components: Pinia. Local component state: `ref`/`reactive`. Don't reach for Pinia for state only one component tree touches.
- DRY: markup/logic/values repeated 3+ times get extracted to a shared component, composable, or design token — not copy-pasted.

## 5. UX consistency

- Every page with async data implements loading (`pending` from `useAsyncData`), empty, and error (`error.vue` or local) states; loading UI approximates the loaded layout's dimensions (no CLS on swap-in).
- Mobile-first CSS, ≥ 44×44px touch targets, immediate (~100ms) feedback on every interactive action.

## 6. Tooling & CI (build-breaking gates)

- `@nuxt/eslint` (with `eslint-plugin-vuejs-accessibility`) and Prettier on every commit/CI run.
- Vitest + `@nuxt/test-utils` + Testing Library for units/components (query by role/label, not implementation detail); Playwright (+ `@axe-core/playwright`) for e2e and accessibility on critical paths.
- Lighthouse CI against a real `nuxt build` + `node .output/server/index.mjs`, with LCP/CLS/performance-score budgets as `error`-level assertions.
- `web-vitals` wired via a `.client.ts` plugin to analytics for real-user field data.
- `README.md` updated in the same PR whenever setup, env vars, scripts, or folder conventions change.

## 7. Before opening a PR

- [ ] Every data fetch needed on initial render uses `useFetch`/`useAsyncData`, not a manual `onMounted` fetch.
- [ ] Keyboard-only walkthrough of the changed flow; zero new `vuejs-accessibility`/axe violations.
- [ ] New images use `<NuxtImg>`/`<NuxtPicture>` with dimensions and descriptive `alt`; LCP image has `preload`.
- [ ] Loading/empty/error states cover new async UI.
- [ ] No hardcoded design value duplicating an existing token; no logic duplicated 3+ times.
- [ ] `nuxi analyze` checked if a new dependency looks heavy; PageSpeed checked if images/rendering mode/data-fetching changed.
- [ ] README updated if setup/config/scripts changed.

<!-- frontend-standard-skills:nuxt END -->

<!-- frontend-standard-skills:react START — do not edit between these markers, regenerate with `npx frontend-standard-skills add react` -->

# Frontend Contributor Rules — React

Applies to every change under `src/components/`, `src/features/`, `src/hooks/`, `src/lib/`, and related directories in this React (Vite/CRA, non-Next.js) project. Self-contained — includes the framework-agnostic baseline plus React-specific practice.

## 1. Component model

- Function components + hooks only. No new class components.
- Code-split routes and heavy, non-critical components with `React.lazy` + `<Suspense>`.
- Reach for `useMemo`/`useCallback`/`React.memo` only for measured-expensive work or to stabilize props into a memoized child — not reflexively on every value/function. Never wrap something you haven't profiled as a problem.
- Never pass a new object/array/function literal as a prop to a `React.memo`-wrapped child — hoist it to module scope or wrap it in `useMemo`/`useCallback` first, or the memoization does nothing.
- Compute derived state during render; don't duplicate it into `useState` synced via `useEffect`.

## 2. Accessibility (WCAG 2.1 AA)

- Real semantic HTML inside JSX (`<button>`, `<nav>`, `<main>`, real `<label htmlFor>` + `<input>`) — no `<div onClick>`.
- Use `useId()` to generate stable, unique label/`aria-describedby` associations in reusable components — never a hardcoded `id` string.
- Every `<img>` has descriptive, context-specific `alt` text, or `alt=""` if decorative, plus explicit `width`/`height`.
- On client-side route change, move focus to the new view's heading/main landmark via a `ref`; mark the active nav link with `aria-current="page"`.
- Custom modals/comboboxes/dropdowns: prefer a maintained headless primitive (Radix UI, React Aria) over hand-rolling focus trapping. If hand-rolled, implement `role="dialog"` + `aria-modal` + focus trap + `Escape`-to-close + focus restore in full.
- Forms: validate on submit, surface errors via `aria-invalid`/`aria-describedby`/`role="alert"`, show a busy state (`aria-busy`) while pending.
- Keep `eslint-plugin-jsx-a11y` enabled and build-breaking in CI.
- Color contrast ≥ 4.5:1 body / ≥ 3:1 large text; never convey state by color alone; respect `prefers-reduced-motion`; text sizing in `rem`/`em`.

## 3. Core Web Vitals (target: LCP < 2.5s · CLS < 0.1 · INP < 200ms, per https://pagespeed.web.dev/)

- Every image has explicit `width`/`height` (or `aspect-ratio`), a correctly sized `srcset`/`sizes`, and `loading="lazy"` unless it's the LCP image — there's no framework image component doing this automatically.
- Preload the actual LCP image/font explicitly (`<link rel="preload">`); never lazy-load it.
- Virtualize any list that can grow past a few hundred rows (`react-window`/`@tanstack/react-virtual`).
- Debounce/throttle high-frequency handlers (search input, scroll, resize); scope state as locally as possible to limit re-render blast radius.
- Measure against a real production build (`vite build && vite preview`, never the dev server); check the Vite/Rollup bundle output (`rollup-plugin-visualizer`) when a dependency looks heavy.
- Use React DevTools Profiler to diagnose re-render/INP problems before reaching for a memoization fix.

## 4. Component & file conventions

- Folder structure: `src/components/ui/` (shared, feature-agnostic), `src/features/<feature>/` (feature-scoped), `src/hooks/`, `src/lib/`, `src/App.tsx`. Features import from shared layers, never the reverse.
- Component files: `PascalCase.tsx`, matching the exported component name — the one intentional exception to the general camelCase-file rule. Custom hooks and utilities: `camelCase.ts`.
- Custom hooks are prefixed `use`, cover exactly one concern, and return a small, predictable shape (tuple or plain object).
- `strict: true` TypeScript, no `any`; every component has an explicit, named prop interface; status-like state uses a discriminated union, not a pile of optional booleans.
- DRY: markup/logic/values repeated 3+ times get extracted to a shared component, hook, or design token — not copy-pasted.

## 5. State management

- Default to local `useState`/`useReducer`. Lift state only as far as the nearest common consumer requires.
- Context is for infrequently-changing, genuinely global state (theme, auth, locale) — never for high-frequency values (live input text) as the context value, since every consumer re-renders on every change.
- Reach for an external store (Zustand, Redux, Jotai) only when state is both widely shared *and* updates frequently enough that Context's re-render-everything model becomes a real, measured cost.
- Avoid prop drilling past two or three levels — use Context or a store instead once it's a pattern, not a one-off.

## 6. UX consistency

- Every async view (fetch, mutation) implements loading, empty, and error states — reflected as an explicit status, not inferred from combinations of booleans.
- Mobile-first CSS, ≥ 44×44px touch targets, immediate (~100ms) feedback on every interactive action.

## 7. Tooling & CI (build-breaking gates)

- ESLint (`eslint-plugin-react`, `eslint-plugin-react-hooks` with `exhaustive-deps`, `eslint-plugin-jsx-a11y`) and Prettier on every commit/CI run.
- Vitest + React Testing Library for units/components (query by role/label, not test-ids or implementation detail); Playwright + `@axe-core/playwright` for e2e and accessibility on critical paths.
- Lighthouse CI against a real `vite build && vite preview` (or CRA equivalent), with LCP/CLS/performance-score budgets as `error`-level assertions.
- `web-vitals` package wired to analytics at the app's entry point for real-user field data.
- `README.md` updated in the same PR whenever setup, env vars, scripts, or folder conventions change.

## 8. Before opening a PR

- [ ] Every new `useMemo`/`useCallback`/`React.memo` is justified by a profiled problem, not added reflexively.
- [ ] Keyboard-only walkthrough of the changed flow; zero new `jsx-a11y`/axe violations.
- [ ] New images have explicit dimensions, descriptive `alt`, and correct `loading`/`srcset` treatment.
- [ ] Loading/empty/error states cover new async UI, represented as an explicit status.
- [ ] No hardcoded design value duplicating an existing token; no logic duplicated 3+ times.
- [ ] Production build bundle size checked for unexpected growth; PageSpeed checked if images/fonts/data-fetching changed.
- [ ] README updated if setup/config/scripts changed.

<!-- frontend-standard-skills:react END -->

<!-- frontend-standard-skills:svelte START — do not edit between these markers, regenerate with `npx frontend-standard-skills add svelte` -->

# Frontend Contributor Rules — Svelte

Applies to every change under `src/routes/`, `src/lib/`, and related directories in this Svelte 5 / SvelteKit project. Self-contained — includes the framework-agnostic baseline plus Svelte-specific practice.

## 1. Reactivity model (Svelte 5 runes)

- **`$state`** for local reactive state; **`$derived`** for any value computed from other reactive state — never a manually-synced `$state` kept in sync via `$effect`. If it can be computed, compute it.
- **`$props()`** with an explicit `interface`/`type` for every component's props — the Svelte 5 replacement for `export let`. Destructure defaults inline (`let { variant = "primary" }: Props = $props();`), don't reassign props after destructuring.
- **Snippets** (`{#snippet}` / `{@render}`) for passing renderable content into a component — the Svelte 5 replacement for slots. Name snippets for what they render (`header`, `row`), not generically (`slot1`).
- **`$effect`** is for side effects only (DOM measurement, subscriptions, syncing to `localStorage`/an external store) — never for computing a value another piece of state could derive. Keep the values an effect reads as narrow as possible so it doesn't rerun for unrelated changes.
- Prefer reassignment (`items = [...items, next]`) over relying on in-place array/object mutation to trigger updates — it's the safer default to reason about even where Svelte 5's proxies would track the mutation.
- Use `$bindable()` only for props that genuinely need two-way binding (a form control wrapper) — default props to one-way (parent → child) and pass an explicit callback prop for child → parent communication otherwise, so data flow stays easy to trace.
- If the project is still on Svelte 4 (`export let`, `$:` reactive statements, stores-first), note that explicitly here — prop/reactivity syntax and idioms differ from the runes conventions above and this section shouldn't be applied as-is.
- Fetch data in `+page.ts`/`+page.server.ts` load functions, close to where it's used — avoid client-side `onMount`/`$effect` fetch waterfalls for data known at request time. Be deliberate about what runs on the server (`+page.server.ts`) vs. universally (`+page.ts`); secrets and privileged data access only ever belong in the server-only file.

## 2. Accessibility (WCAG 2.1 AA)

- Real semantic HTML in templates (`<button>`, `<nav>`, `<main>`, real `<label for>` + `<input>`) — no `<div onclick>`.
- **Every Svelte compiler `a11y_*` warning is build-breaking.** Never suppress with `<!-- svelte-ignore -->` without a specific, documented reason — fix the underlying markup.
- `svelte-check` runs in CI and fails the build on new warnings, type errors, or a11y issues.
- Icon-only buttons have `aria-label`; decorative icons/images have `aria-hidden="true"`/`alt=""`.
- Move focus to `<main>`/the page heading on client-side route changes (SvelteKit's router doesn't reload the page). Mark the active nav link with `aria-current="page"`.
- Custom modals implement `role="dialog"` + `aria-modal` + focus management (`bind:this` for programmatic focus) + `Escape`-to-close + focus restore — prefer a maintained headless primitive (Melt UI, Bits UI) over hand-rolling a focus trap.
- Form fields have real associated `<label>`s; errors use `aria-invalid`/`aria-describedby`/`role="alert"`, validated server-side in `+page.server.ts` actions too — never trust client-only validation.
- Color contrast ≥ 4.5:1 body / ≥ 3:1 large text; never convey state by color alone; respect `prefers-reduced-motion`; text sizing in `rem`/`em`.
- Dynamic content updates (toasts, filtered result counts, save confirmations) are announced via `aria-live="polite"` (or `role="alert"` for urgent/error cases) — a silent DOM update is invisible to a screen-reader user.
- Every route sets a specific, descriptive `<title>` via `<svelte:head>` (or a shared layout helper) — screen-reader users rely on the title to confirm a navigation succeeded. Set `lang` on the root `<html>` (in `src/app.html`).
- `loading`/pending states for slow data (`{#await}` blocks, streamed promises from a load function) get an `aria-live="polite"` region or accessible name — an unannounced spinner is invisible to a screen-reader user, same as a silent error boundary.
- Custom widgets (dropdowns, comboboxes, tabs) follow the keyboard interaction pattern from the [WAI-ARIA Authoring Practices Guide](https://www.w3.org/WAI/ARIA/apg/patterns/) for that widget type — don't invent a bespoke keyboard scheme.

## 3. Core Web Vitals (target: LCP < 2.5s · CLS < 0.1 · INP < 200ms · Lighthouse Performance ≥ 90 mobile, per https://pagespeed.web.dev/)

- `<enhanced:img>` (`@sveltejs/enhanced-img`) for locally-imported images — automatic `srcset`, modern formats, and CLS-safe intrinsic dimensions. Explicit `width`/`height` always for any image not using it.
- `export const prerender = true` for static routes — the biggest available TTFB/LCP win. Reserve full SSR for genuinely per-request/dynamic content; use `csr = false` for zero-interactivity pages.
- `data-sveltekit-preload-data` on links for near-instant navigations.
- Prefer `$derived` over `$effect` to avoid redundant re-computation; scope `$effect` dependencies tightly; debounce high-frequency triggers (search-as-you-type, scroll/resize-driven state).
- Code-split heavy, non-critical components with dynamic `import()`.
- Measure against `vite build && vite preview` (or the deployed adapter output), never `vite dev`. Watch bundle size per route; use `rollup-plugin-visualizer` when a dependency looks heavy.
- Pick the deployment adapter deliberately (`adapter-static` for fully prerenderable sites, `adapter-node`/`adapter-vercel` for SSR) — a static adapter removes server compute from the request path entirely for content that doesn't need it.
- Reserve space for any dynamically loaded, non-image content (ads, embeds, banners injected client-side) with a sized container, same as the image rule above.
- Third-party scripts load `async`/`defer` (or are injected only after the interaction that needs them) and are audited periodically — they're a leading contributor to poor LCP/INP in production apps.
- Svelte's compile-away reactivity ships less baseline JS than virtual-DOM frameworks by default — real, but not a substitute for the above; a heavy dependency or a thrashing `$effect` still costs the user regardless of the framework underneath it.

## 4. Component & file conventions

- SvelteKit structure: `src/routes/<segment>/+page.svelte`, `+layout.svelte`, `+page.ts`/`+page.server.ts`, `+error.svelte`, `+server.ts` — these are fixed framework file names, not stylistic choices.
- Route segment folders: `kebab-case`. Component files: `PascalCase.svelte`. Everything else (`lib/utils/`, non-component `.ts`): `camelCase.ts`.
- Shared code imported via the `$lib` alias (`$lib/components/ui/...`), never long relative paths.
- Shared, feature-agnostic components live in `lib/components/ui/`; feature-only components live beside the feature/route. Shared components never import feature-specific code.
- `strict: true` TypeScript, no `any`; explicit `Props` interfaces, exported when other files need to reference them; load-function types imported from generated `./$types` rather than hand-duplicated.
- Form action inputs validated (e.g. Zod) inside `+page.server.ts`, never trusted implicitly from raw `FormData`.
- DRY: markup/logic/values repeated 3+ times get extracted to a shared component, utility, or design token — not copy-pasted.
- A component file over roughly 200-300 lines (excluding styles/types), or one doing more than one cohesive thing, is a signal to split it into named, clearly-scoped pieces.
- Organize `lib/` by feature/domain once the project grows past a handful of components — avoid a flat `lib/components/` directory with dozens of ungrouped files.

## 5. Anti-patterns to flag in review

- Global stores (`writable` in `$lib/stores`) used for state that's only read/written by one component tree — that belongs in local `$state`. A store is for genuinely shared, cross-component state.
- Deeply nested `{#if}`/`{:else if}` chains (more than two or three branches) instead of a component extracted per branch.
- `onMount`/`$effect` fetching data a `+page.ts`/`+page.server.ts` load function could fetch instead (causes a client-visible waterfall and worse LCP than data resolved during SSR/load).
- Suppressing an `a11y_*` compiler warning with `<!-- svelte-ignore -->` instead of fixing the markup, without a specific documented reason.
- Marking an entire component/route as needing heavy client-side interactivity when only a small leaf actually needs it — keep interactive surface area (and its associated hydration cost) as small as possible.
- Hand-rolling a modal/dialog/combobox focus trap when a maintained headless primitive (Melt UI, Bits UI) is available and would be more robust.

## 6. UX consistency

- Loading UI (skeletons, `{#await}` pending branches) approximates the loaded content's dimensions — no CLS on swap-in. Every async view has loading, empty, and error states; "nothing happens" is never acceptable.
- The same action looks and behaves the same way everywhere (primary/destructive button semantics, confirmation patterns) — enforced via the shared `lib/components/ui/` layer, not re-implemented per feature.
- Mobile-first CSS, ≥ 44×44px touch targets, immediate (~100ms) feedback on every interactive action.
- Use a shared spacing/type scale via design tokens (CSS custom properties or a theme module) — no arbitrary one-off pixel values in component styles.
- Empty states are explicit and actionable (e.g. "No results — try a different filter"), not a blank container that looks broken.

## 7. Tooling & CI (build-breaking gates)

- `eslint` (with `eslint-plugin-svelte`'s recommended config) and Prettier on every commit/CI run.
- `svelte-check` as its own required CI step (type errors + compiler a11y warnings) — passing ESLint does not imply this passed.
- Vitest + `@testing-library/svelte` for units/components (query by role/label, not implementation detail); Playwright (+ `@axe-core/playwright`) for e2e and accessibility on critical paths.
- Lighthouse CI against a real `vite build && vite preview`, with LCP/CLS/performance-score budgets as `error`-level assertions.
- `web-vitals` wired in the root `+layout.svelte` to analytics for real-user field data.
- `README.md` updated in the same PR whenever setup, env vars, scripts, or folder conventions change.

## 8. Before opening a PR

- [ ] No new `a11y_*` compiler warnings; `svelte-check` passes clean.
- [ ] Keyboard-only walkthrough of the changed flow; zero new axe violations.
- [ ] New images use `<enhanced:img>` or have explicit dimensions and descriptive `alt`.
- [ ] Any new `$effect` is a genuine side effect, not a value that should be `$derived`.
- [ ] Loading/empty/error states cover new async UI.
- [ ] No hardcoded design value duplicating an existing token; no logic duplicated 3+ times.
- [ ] Bundle size checked for unexpected growth; PageSpeed checked if images/routing/data-fetching changed.
- [ ] No new global store introduced for state that's actually local to one component tree.
- [ ] Every new/changed route has a specific `<title>` and, if async, an accessible loading state.
- [ ] Form action inputs are validated server-side, not just via `bind:value` client checks.
- [ ] README updated if setup/config/scripts changed.

## 9. Escalation

If a rule above conflicts with a specific, documented project constraint (e.g. a legacy Svelte 4 subsystem, a third-party embed that can't meet a CLS budget), note the exception and its reasoning directly in the PR description rather than silently deviating — the goal is a deliberate, reviewable trade-off, not an unnoticed regression.

<!-- frontend-standard-skills:svelte END -->

<!-- frontend-standard-skills:vuejs START — do not edit between these markers, regenerate with `npx frontend-standard-skills add vuejs` -->

# Frontend Contributor Rules — Vue.js

Applies to every change under `src/components`, `src/composables`, `src/views`, `src/stores`, `src/router`, and related directories in this Vue 3 (Composition API, Vite SPA) project. Self-contained — includes the framework-agnostic baseline plus Vue-specific practice.

## 1. Component model

- **`<script setup lang="ts">` for every new SFC.** No Options API, no runtime-only `defineProps`/`defineEmits` in new code.
- `ref` for primitives and anything that may be reassigned or destructured; `reactive` only for a cohesive object you'll never reassign whole. `shallowRef`/`shallowReactive` for large data (API result sets, chart data) that doesn't need deep reactivity.
- `computed` instead of a manually-synced `ref` + `watch` for any derived value.
- Never mutate a prop directly — emit an event and let the parent own the update.
- Route-level components are lazy: `{ path: "/x", component: () => import("../views/XView.vue") }` — never a static top-level import for a route.

## 2. Accessibility (WCAG 2.1 AA)

- Real semantic HTML inside templates (`<button>`, `<nav>`, `<main>`, real `<label for>` + `<input>`) — no `<div @click>`.
- Every `<img>` has descriptive, context-specific `alt`, or `alt=""` if decorative, plus explicit `width`/`height`.
- Move focus via template refs (`ref="..."`, `await nextTick()` before touching a freshly `v-if`'d ref) on dialog open/close and route change; restore focus to the trigger on close.
- Bind `:aria-*`/`:class` reactively to the same state driving the visual change — never toggle ARIA attributes imperatively via `document.querySelector`.
- Custom modals implement `role="dialog"` + `aria-modal` + focus trap + `Escape`-to-close + focus restore — prefer a maintained headless primitive (Radix Vue, Headless UI for Vue) over hand-rolling.
- `v-html` only for sanitized (e.g. `DOMPurify`) content; never for interactive markup (buttons/links) — render real components instead.
- Keep `eslint-plugin-vuejs-accessibility` enabled and build-breaking in CI.
- Color contrast ≥ 4.5:1 body / ≥ 3:1 large text; never convey state by color alone; respect `prefers-reduced-motion`; text sizing in `rem`/`em`.

## 3. Core Web Vitals (target: LCP < 2.5s · CLS < 0.1 · INP < 200ms, per https://pagespeed.web.dev/)

- No built-in image component — every `<img>` gets explicit `width`/`height`, modern format, correct sizing, and `loading="lazy"` unless it's the LCP image (never lazy-load the LCP image; use `fetchpriority="high"` and preload if known at build time).
- `defineAsyncComponent` + `<Suspense>` for heavy, non-critical components (editors, charts, large modals) so their JS isn't in the initial bundle.
- `v-memo` for expensive `v-for` list items, only after Vue DevTools profiling shows a real re-render cost — not by default.
- Scope `ref`/`reactive` state as locally as possible; debounce high-frequency handlers; avoid deep reactivity on large, rarely-mutated data via `shallowRef`/`shallowReactive`.
- Measure against `vite build && vite preview`, never `vite dev`. Use `rollup-plugin-visualizer` when a dependency looks heavy; use Vue DevTools to confirm a re-render fix actually helped.

## 4. Component & file conventions

- Folder structure: `src/components/ui` (shared), `src/components/<feature>` (feature-scoped), `src/composables`, `src/views` (routed components), `src/stores` (Pinia), `src/router`.
- Component files: `PascalCase.vue`. Composables: `useX.ts` camelCase, one concern per composable. Everything else: `camelCase.ts`.
- `defineProps<T>()`/`defineEmits<T>()` with a generic type — no runtime-only prop declarations, no `any`. `withDefaults` for default prop values.
- Pinia (setup-style store) for state crossing 3+ component levels or living outside one component tree — one store per domain, not a single monolith store.
- DRY: markup/logic/values repeated 3+ times get extracted to a shared component, composable, or design token — not copy-pasted.
- Avoid deeply nested `v-if`/`v-else-if` chains — use a `computed` view-state or extracted subcomponents instead.

## 5. UX consistency

- Every view with async data implements loading, empty, and error states — loading skeletons approximate the loaded layout's dimensions (no CLS on swap-in).
- Mobile-first CSS, ≥ 44×44px touch targets, immediate (~100ms) feedback on every interactive action.

## 6. Tooling & CI (build-breaking gates)

- `eslint-plugin-vue` + `eslint-plugin-vuejs-accessibility` + Prettier on every commit/CI run.
- Vitest + `@testing-library/vue` for units/components (query by role/label, not implementation detail); Playwright (+ `@axe-core/playwright`) for e2e and accessibility on critical paths.
- Lighthouse CI against a real `vite build && vite preview`, with LCP/CLS/performance-score budgets as `error`-level assertions.
- `web-vitals` (`onLCP`/`onCLS`/`onINP`) wired to analytics for real-user field data.
- `README.md` updated in the same PR whenever setup, env vars, scripts, or folder conventions change.

## 7. Before opening a PR

- [ ] Every new component uses `<script setup lang="ts">`; no `any` in props/emits.
- [ ] Keyboard-only walkthrough of the changed flow; zero new `vuejs-accessibility`/axe violations.
- [ ] New images have explicit dimensions and descriptive `alt`; LCP image is never lazy-loaded.
- [ ] Loading/empty/error states cover new async UI.
- [ ] No hardcoded design value duplicating an existing token; no logic duplicated 3+ times.
- [ ] Vite bundle checked for unexpected growth if a new dependency was added; PageSpeed checked if images/fonts/data-fetching changed.
- [ ] README updated if setup/config/scripts changed.

<!-- frontend-standard-skills:vuejs END -->
