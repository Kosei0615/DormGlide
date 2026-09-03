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

## Needs approval / later

| # | Issue | Recommendation |
|---|---|---|
| A | Bottom-nav Messages tab has no unread badge — users won't know they have new messages without opening it | Wire the existing unread count (Header already computes it) into BottomNav via shared state or a small event. Medium effort, high value. Recommend doing in Phase 2 alongside chat work |
| B | Privacy Policy page has one 13px-tall empty anchor (decorative/possibly dead link) | Inspect and remove or enlarge during Phase 6 polish |
| C | The hamburger "Menu" still duplicates Browse/Sell (now also in bottom nav) | Consider slimming the hamburger to secondary items only (How It Works, Policy, Logout) in Phase 6 |
| D | Pane cannot log in (sandbox can't reach Supabase), so logged-in mobile screens (dashboard, messages, wishlist) are audited by code-reading only | Founder should click through logged-in pages on a real phone after each deploy |
