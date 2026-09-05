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

## Needs approval / later

| # | Issue | Recommendation |
|---|---|---|
| A | Bottom-nav Messages tab has no unread badge — users won't know they have new messages without opening it | Wire the existing unread count (Header already computes it) into BottomNav via shared state or a small event. Medium effort, high value. Recommend doing in Phase 2 alongside chat work |
| B | Privacy Policy page has one 13px-tall empty anchor (decorative/possibly dead link) | Inspect and remove or enlarge during Phase 6 polish |
| C | The hamburger "Menu" still duplicates Browse/Sell (now also in bottom nav) | Consider slimming the hamburger to secondary items only (How It Works, Policy, Logout) in Phase 6 |
| D | Pane cannot log in (sandbox can't reach Supabase), so logged-in mobile screens (dashboard, messages, wishlist) are audited by code-reading only | Founder should click through logged-in pages on a real phone after each deploy |
| E | Product page still shows the old timestamp-based "Deal Timeline" card alongside the new deal panel — two narrations of the same story | Recommend removing the old card in Phase 6 polish once the panel is proven |
| F | Stripe Payment Link field on the Sell form predates the "DormGlide never handles money" positioning | Recommend removing/hiding it — conflicts with the payment guidance; needs founder call |

## Fixed (post-Phase-2, founder-approved)

| # | Issue | Fix |
|---|---|---|
| F | Stripe Payment Link field contradicted "DormGlide never handles money" | Removed from the Sell form (approved by founder). Legacy payment_link data untouched |
