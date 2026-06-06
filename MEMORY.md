# MEMORY.md - Long-Term Curated Memory

## Core Project Reality (as of 2026-06-01)

**Aarya Clothing** is a full-stack e-commerce platform (Next.js frontend + Python/FastAPI microservices for commerce, payment, core auth, admin) with heavy emphasis on:
- Premium ethnic wear (sarees, kurtis, etc.)
- Complex auth (email + phone + OTP via SMS/WhatsApp)
- Razorpay + UPI/QR payments with recovery flows
- Inventory with variants, reservations, stock movements
- Admin + staff roles, returns, reviews, AI features

## Critical Technical Lessons (Hard-Won)

### Git Hygiene & AI Tooling (June 2026 Incident)
- **Never** do large-scale AI-assisted edits (Cursor, Windsurf, Claude Code, etc.) on a mixed Windows + WSL/Linux environment without a locked-down `.gitattributes` + `core.autocrlf=input` + pre-commit whitespace hooks.
- On 2026-06-01 we discovered 549 files polluted with CRLF + trailing whitespace from an AI session. Only 16 files had real changes. This made the entire `git status` / `git diff` surface unusable.
- **Rule:** After any AI coding burst, always run `git diff --ignore-cr-at-eol -w --stat` before staging anything. If >20 files light up with no `-w` diff, you have noise.
- Fix pattern: `git checkout -- .` (discard noise) then surgically re-apply only the real diffs.

### Payment / Order Reliability (From May 27 Audit + June 1 follow-up)
Key architectural risks that were actively being remediated:
1. Network calls (Razorpay) while holding row locks → connection pool exhaustion.
2. Webhook errors silently swallowed (200 OK returned) → paid orders lost.
3. Sub-services doing direct `.commit()` breaking outer transaction rollback.
4. "authorized" vs "captured" status for UPI flows (fixed in payment_service.py).
5. Double creation of pending_order snapshots.
6. Direct `variant.quantity -=` instead of going through InventoryService with FOR UPDATE + denorm sync.

The June 1 real changes (the 16 files) were largely the continuation of that audit remediation + mobile UX hardening.

### Frontend Mobile Audit Pattern
Consistent recent work (hotfix-branch):
- Typography bumps on helper text (9-10px → 11px) for touch readability.
- Phone number UX: explicit format examples everywhere, better placeholders.
- Sticky mobile CTAs, safe-area handling (`env(safe-area-inset-bottom)`, `h-dvh`, `bottom-nav-offset` class).
- Review UX: visual star ratings per review.
- Checkout flow: unified processing state machine with progress checklist instead of multiple loading spinners.

## Current Branch Context
- `hotfix-branch` is the active line for mobile polish + payment recovery hardening.
- Last intentional commit before the noise: mobile UI/UX audit (header, collections, iOS zoom, OTP, stepper, invoice, tracking).
- The 7 staged files on 2026-06-01 were clean, small, high-value continuations of exactly that work.

## Standing Rules for This Repo
- When in doubt about uncommitted changes: run the `-w --ignore-cr-at-eol` filter first.
- Backend stock/inventory changes must always go through `InventoryService` methods (never mutate quantities directly in order_service).
- Auth phone handling must be consistent (with/without +91, multiple formats accepted).
- Never commit whitespace-only or line-ending diffs.
- Maintain `.gitattributes` aggressively.

## Personal Notes
- This workspace is used with multiple AI coding surfaces (Windsurf, Cursor, direct Claude, etc.). The human moves fast and expects the assistant to be the "cleaner" that catches the side-effects.
- Payment reliability is currently the highest business risk area.
- Mobile experience (especially auth + checkout on real devices) is the current UX focus.

### User Guidance & Instruction Debt (June 2026 Discovery)
- The hardest user friction is **not** missing features — it is missing, inconsistent, or buried instructions and error recovery guidance in the two most important flows: Authentication (login/OTP/register with phone requirements) and Variant Selection (size + color for real garments).
- Login/OTP pages use generic placeholders with no examples at the input. Helpful phone format text is duplicated in 4+ places with slight differences and often appears too late or only on the Register page.
- Variant UI has sophisticated matching logic but zero proactive instructional text ("Select size and color...").
- This produces exactly the support pain the user described: "no proper instructions in login and all for the users".
- Fix principle: One canonical `authCopy.js` + one clear variant instruction + consistent recovery guidance. Do the text/copy work first (highest ROI, zero risk) before any architecture changes.

(Updated 2026-06-02 after full user-instruction + auth/variant flow audit)

## 2026-06-04 Deep Uncommitted Audit Lessons
- **Always** re-audit with `git diff --ignore-cr-at-eol -w` (and --name-only) before any "are these good?" review. 41 real files vs hundreds of noise.
- Exception handler DRY to shared/base_exception_handler.py is good pattern (supports custom exc + mappings), but **always verify the call to setup_... (or register_...) in every service's main.py after the split**. Commerce was missed in this batch → no standardized errors for the most critical service.
- Two error systems now coexist (shared/error_responses.register vs base setup). Plan consolidation.
- Denormalized total_stock + silent logger.warning syncs are here to stay for perf; the new admin /reconcile-total-stock (dry_run + fix) is the right operational countermeasure.
- AuthCopy adoption + variant instruction + checkout progress checklist = textbook "copy first" high-ROI from the guidance plan. Continue that pattern.
- Locking refactor in cart (outer CartConcurrencyManager only) + stock via InventoryService + "authorized" UPI + cart-clear-to-FE = direct remediation of the 05-27/06-01 payment reliability risks. High confidence here.
- Still no .gitattributes at root. This keeps biting. Add it + enforce in next hygiene pass.
- Untracked files from refactors/guidance (shared/*.py, authCopy.js, the plan doc) must be explicitly added; they are part of the "good" changes.

New standing rule: After any shared/ refactor (exceptions, db helpers, etc.), grep all *main.py for the registration call before declaring done.

### Frontend Docker + Bundler Cache Discipline (2026-06-04 Silk + "run docker" incident)
- **NEVER trust a "running" frontend container** after layout.js, next.config.js, SilkBackground, GSAP, landing heavy client components, or any webpack-affecting change. The anon /app/.next volume + browser immutable cache on /_next/static will make the *old* error keep happening even after source edits + container restarts.
- **Ritual (mandatory, no shortcuts):**
  1. Edit the file(s).
  2. `docker compose -f docker-compose.yml -f docker-compose.dev.yml stop frontend`
  3. Identify .next vol: `docker inspect aarya_frontend --format '{{ range .Mounts }}{{ if eq .Destination "/app/.next" }}{{ .Name }}{{ end }}{{ end }}'`
  4. Wipe with sidecar: `docker run --rm -v $VOL:/data alpine sh -c 'find /data -mindepth 1 -delete 2>/dev/null || true; mkdir -p /data'`
  5. `docker compose ... start frontend` (or --force-recreate --no-deps after a `build --no-cache frontend`)
  6. `docker logs aarya_frontend --tail 20` (expect clean "Ready in <3s", no errors)
  7. `curl -k -I https://localhost/` (expect 200, not 500)
  8. **Tell the human explicitly:** "Hard reload the browser (Ctrl/Cmd+Shift+R or DevTools Network > Disable cache + reload). The dev chunk headers now prevent caching in dev."
- **Config rule:** In next.config.js headers(), the long `immutable` / max-age for `/_next/static/*` and fonts **must be inside `if (process.env.NODE_ENV === 'production')` only**. Dev gets explicit no-cache. (This was the hidden cause of "before uncommitted it was perfect / why again and again after docker".)
- Direct `rm -rf /app/.next` inside running container often fails "Resource busy" — use the stop + vol inspect + alpine sidecar pattern.
- SilkBackground (and similar WebGL/GSAP client roots) are safe to static-import from the server RootLayout because they are 'use client'. Never wrap them with next/dynamic({ssr:false}) from a Server Component (produces the ModuleBuildError).
- After the ritual, if the exact same .call error at Silk line 5 persists on hard-reload, then (and only then) investigate the module's 3 imports (react, next/navigation, @/lib/logger) or introduce a dynamic wrapper *from another 'use client' file*.
- This + the earlier CRLF filter rule keeps the "it worked before my changes" signal trustworthy.

### Heavy client-only components in root layout (SilkBackground lesson)
- Never put large 'use client' modules that have heavy top-level code (big shader strings, WebGL init, lots of refs) as a *direct static import* in the server RootLayout. Even though it's allowed, it pulls them into the initial layout client chunk. In dev (especially after removing splitChunks or with WSL paths), this leads to "module factory undefined .call" during webpack eval of the layout chunk.
- Correct pattern: tiny 'use client' wrapper that does `dynamic(() => import('./Heavy'), { ssr: false })`, then import the *wrapper* from the server layout. The heavy code moves to its own async chunk, loaded after hydration.
- Always follow with full docker FE ritual (stop + .next vol wipe via alpine sidecar + start) + tell user to hard-reload. The no-cache dev header rule we added helps future changes be visible faster.
