---
name: weekly-growth
description: Produce DormGlide's weekly growth readout and plan next week's marketing. Combines Instagram results from Metricool with sign-ups by source, listings, and deal activity from the Supabase database, then recommends what to post next. Use this whenever the founder asks how DormGlide is doing, whether Instagram / posters / tabling is working, for weekly numbers, sign-up counts, a growth or marketing report, "analyze and improve", or what to post next week, even if they don't say "report".
---

# weekly-growth

The founder's goal is **sign-ups that turn into listings**, not likes. This
readout answers one question: which channel and which content produced active
students this week, and what should change next week because of it.

## 1. Pull the numbers

**Database** (Supabase MCP `execute_sql`; project ref `tmyjkucirpfquxostdhb`).
Compare the last 7 days with the 7 days before:

```sql
select
  case when p.signup_source in ('ig', 'insta', 'instagram') then 'instagram' else coalesce(p.signup_source, 'unknown') end as source,
  count(*) filter (where u.created_at > now() - interval '7 days') as signups_7d,
  count(*) filter (where u.created_at <= now() - interval '7 days' and u.created_at > now() - interval '14 days') as signups_prev_7d,
  count(*) filter (where u.created_at > now() - interval '7 days' and u.email_confirmed_at is not null) as confirmed_7d,
  count(*) filter (where u.created_at > now() - interval '7 days' and p.onboarded_at is not null) as onboarded_7d
from public.profiles p join auth.users u on u.id = p.id
group by 1 order by 2 desc;
```

```sql
select
  (select count(*) from auth.users) as total_users,
  (select count(*) from products where created_at > now() - interval '7 days' and coalesce(listing_type,'goods') <> 'service') as new_listings_7d,
  (select count(*) from products where created_at > now() - interval '7 days' and listing_type = 'service') as new_services_7d,
  (select count(*) from purchase_requests where created_at > now() - interval '7 days') as new_requests_7d,
  (select count(*) from purchase_requests where status = 'completed' and created_at > now() - interval '30 days') as completed_deals_30d,
  (select count(*) from conversations where created_at > now() - interval '7 days') as new_conversations_7d,
  (select count(*) from keyword_alerts where created_at > now() - interval '7 days') as new_alerts_7d,
  (select count(distinct seller_id) from products where created_at > now() - interval '7 days') as distinct_sellers_7d;
```

Sources you will see: `instagram` (QR / dormglide.com/ig; older rows may say `ig`, the query folds them together), `poster-dorm`,
`poster-glyde` (the two campus posters), `tabling-2026-09-27` (back-filled
cohort), `typed-url`, `direct`, and `unknown` (accounts older than attribution).

If the MCP returns "Unauthorized", the access token in `../.mcp.json` has
expired (30-day tokens; the current one runs out around 2026-10-30). Ask the
founder to generate a new scoped token and replace it in that file. Never ask
them to paste it in chat.

**Instagram** (Metricool, brand id `7135581`, timezone `America/New_York`):
- `getScheduledPosts` for the past 7 days to list what was published, with URLs.
- `getAnalyticsDataByMetrics` with post fields `IGPO01`–`IGPO16` and account
  fields `IGAC01`–`IGAC08` for the same range. Known columns: 01 date,
  02 datetime, 03 caption, 04 id, 05 image, 06 permalink, 07 type; 08–16 are
  numeric (reach / impressions / likes / comments / saves in some order, the
  catalog is too large to fetch here). Report the numbers per post and say
  honestly when a column's meaning is uncertain; ask the founder to read reach
  and profile visits off Instagram Insights if a figure matters to a decision.
- `getBestTimeToPostByNetwork` for the coming week.

## 2. Write the readout

Use this structure, with real numbers and no padding:

```
# DormGlide week of <date>

## Headline
One sentence: what moved, and why.

## Sign-ups by source
| Source | This week | Last week | Confirmed | Onboarded |

## Activity
New listings · new services · requests · completed deals · conversations

## Instagram
| Post / story | Date | Reach-type metric | Engagement | Notes |

## What worked, what didn't
Two or three bullets tied to numbers. Compare channels on sign-ups, not likes.

## Next week
Concrete schedule: which posts and stories on which days, and one experiment.
```

Be straight about small numbers. With a few dozen users, one sale or one
poster location can explain a whole week, so say "too early to tell" when it is.
The activation gap matters most: sign-ups that never list anything. If
onboarded or listing counts lag sign-ups, recommend an activation step (a
follow-up email through `public.email_outbox`, never a raw `net.http_post`
loop) before recommending more acquisition.

## 3. Act on it, with consent

Propose the schedule, then schedule it with the `ig-post` skill once the
founder agrees. Bulk emails to users are sent by the founder (run the SQL
themselves); prepare the script and outbox rows, do not send.

Record anything a later session needs in `../HANDOFF.md`.
