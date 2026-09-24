# UX Issues Log

Running log of UX problems found while working through the student-feedback phases.
**Fixed** items were small and clearly improvements; **Needs approval** items await the founder's decision.

## Fixed (Phase 1)

| # | Issue | Fix |
|---|---|---|
| 1 | `confirm()` dialog gated logout; several mobile in-app browsers suppress it (returns false), so the logout tap did nothing | Removed the dialog; logout acts immediately with an info toast (low-stakes, instantly reversible) |
| 2 | `logoutUser` skipped `supabase.auth.signOut()` whenever the 30s circuit breaker was tripped (common on flaky phone connections) → session persisted → refresh logged the user back in | signOut always attempted; falls back to `scope:'local'`, then to purging `sb-*` tokens directly. Verified: session unrecoverable even with a dead network |
| 3 | No auth action visible on the first phone screen (testers couldn't find signup) | Always-visible "Log in" pill in the header bar on mobile when logged out |
| 4 | Wishlist / Saved Items / Messages / listings buried behind the hamburger menu on phones | Persistent bottom tab bar (<768px): Browse / Wishlist / Sell / Messages / Me (or Sign up when logged out). Logged-out taps on gated tabs open the auth modal. Safe-area padding for notched phones |
| 5 | Footer links 26px tall, social icons 40px — below the 44px touch minimum | 44px min targets on mobile for footer links, social icons, nav buttons, tabs, modal close, category cards |

## Fixed (Phase 2)

| # | Issue | Fix |
|---|---|---|
| 6 | Buyer's purchase request tried to update the product's status as the buyer — silently blocked by RLS (products are seller-writable only), so listings never actually showed "pending" in Supabase mode | Listing status is now synced by a security-definer database trigger on purchase_requests; the client no longer writes products during the deal flow |
| 7 | Seller "Confirm Purchase" button was ambiguous (it force-sold the listing outside any request) | Relabeled "Mark as Sold"; the guided flow is the primary path |
| 8 | Bottom-nav Messages tab had no unread indicator (item A) | Live unread badge fed by the existing realtime subscription; clears on opening Messages |

## Fixed (Phase 6)

| # | Issue | Fix |
|---|---|---|
| B | Tiny (13px) control on Privacy Policy page | It was the policy-acknowledgment checkbox; now 22px with a 44px touch row (the earlier "dead anchor" guess was fixed by the footer tap-target CSS) |
| C | Hamburger menu duplicated the bottom tab bar (Browse/Sell/Wishlist/Messages/Dashboard) | Slimmed to secondary items only: How It Works, Policy, Saved Items, Notifications, Profile, Admin, Logout (logged out: How It Works, Policy, Log In, Sign Up) |
| E | Old timestamp "Deal Timeline" card duplicated the deal panel's story | Removed; the deal panel is the single narration of a deal |

## Needs approval / later

| # | Issue | Recommendation |
|---|---|---|
| D | Pane cannot log in (sandbox can't reach Supabase), so logged-in mobile screens (dashboard, messages, wishlist) are audited by code-reading only | Founder should click through logged-in pages on a real phone after each deploy |

## Fixed (post-Phase-2, founder-approved)

| # | Issue | Fix |
|---|---|---|
| F | Stripe Payment Link field contradicted "DormGlide never handles money" | Removed from the Sell form (approved by founder). Legacy payment_link data untouched |

## Logged during Glyde Phase 2 (not built — recommendations)

| # | Issue | Recommendation |
|---|---|---|
| G1 | Goods listings and Glyde services share one Sell entry; a seller who lands on Sell from Glyde mode gets the Service branch pre-selected, but from the bottom bar they see the chooser every time | Remember the last chosen type per device (like the mode switch) so repeat posters skip the chooser |
| G2 | Service cards show a rating slot but ratings are per-seller (goods + services combined) and not yet fetched on the browse grid | Phase 3 provider stats: batch-fetch rating summaries for visible providers |
| G3 | The wishlist keyword-match trigger now also matches services (category mirrors service_category) — a "tutoring" alert fires for tutoring services. Intended, but the alert email copy says "listing" | Phase 3: adjust wording to "listing or service" |
| G4 | Reserve-ahead copy ("Reserve now · pickup") shows on services with a future available_from | Phase 3: say "Bookable from <date>" for services |

## Fixed (Glyde Phase 3)

| # | Issue | Fix |
|---|---|---|
| G1 | Repeat posters saw the Item/Service chooser every time | Last choice remembered per device (`dormglide_last_listing_type`); still changeable via the "← change" link |
| G2 | Service cards had a rating slot but never fetched ratings | Glyde browse batch-fetches one rating summary per visible provider |
| G4 | Reserve-ahead copy ("Reserve now · pickup") showed on services with a future available_from | Services now say "Bookable from <date>" on cards and the detail banner |
| — | Sort dropdown on Glyde browse was 36px tall on phones | 44px minimum on mobile |

## Still open

| # | Issue | Recommendation |
|---|---|---|
| G3 | Wishlist match email says "listing" even when the match is a service (alerts now match services by category — intended) | SQL-only wording change in the 07 trigger function ("listing or service"); do it alongside the next migration |
| G5 | Request-board responses have no notification to the requester beyond the chat thread itself; requesters must check Messages | If boards go quiet, add "a provider responded" notifications (founder chose no notifications for v1) |
| G6 | Admin Glyde panel shows counts but reports are read-only there (no resolve button) | Add a "mark resolved" action once report volume justifies it; today: `update public.reports set status='resolved' where id=...` |
| D | Logged-in flows (post service, book, board respond) are code-verified only — sandbox can't log in | Founder phone test with the +test account |

## Fixed (bug report, 2026-09-24)

| # | Issue | Fix |
|---|---|---|
| G7 | Switching Glyde → DormGlide showed a blank Browse page (reported by a student tester). Root cause: the scroll-reveal IntersectionObserver in HomePage ran once on mount (`[]` deps); the goods sections remount on switch-back and stayed at opacity 0 | Observer effect keyed to `mode`; on any re-run the sections are shown immediately (no animation), plus a no-IntersectionObserver fallback. Verified: all four sections visible after two round-trips |

## Resolved (2026-09-24)

| # | Issue | Fix |
|---|---|---|
| Brand | Google/tab icon was the old green house; the otter design was blocked on a file + Glide/Glyde decision | Naming settled: **DormGlide** (company/app) → **Glyde** (services mode). Otter mark recovered from Alec's mock, favicon/apple-touch/OG image generated from it; public landing page at index.html |
