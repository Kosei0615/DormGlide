-- 25_housing_policy.sql — Denison housing policy enforcement for Dorm listings
-- Idempotent. Mirrors js/utils/policy.js (keep in sync; regenerate with
-- node -e "global.window={};require('./js/utils/policy.js');console.log(DormGlidePolicy.sqlPattern())").
--
-- 1) products.policy_flag / policy_flagged_at
-- 2) policy_match(text): label of the first prohibited item found, else null
-- 3) BEFORE trigger: flags goods listings whose title/description match;
--    clears the flag when the seller edits the words out.
-- 4) AFTER trigger: notifies the seller and every admin when a flag is set.
-- 5) RLS: flagged listings are visible only to their seller and admins.
-- 6) One-time sweep of existing listings.

alter table public.products add column if not exists policy_flag text null;
alter table public.products add column if not exists policy_flagged_at timestamptz null;
create index if not exists products_policy_flag_idx on public.products (policy_flag) where policy_flag is not null;

create or replace function public.policy_match(input text)
returns text
language plpgsql
immutable
set search_path = public
as $$
declare
  t text := ' ' || lower(regexp_replace(coalesce(input, ''), '\s+', ' ', 'g')) || ' ';
  phrase text;
begin
  foreach phrase in array array['flameless candle', 'led candle', 'electric candle', 'battery candle', 'candle warmer', 'candle holder', 'mattress topper', 'mattress pad', 'mattress protector', 'mattress cover', 'mattress encasement', 'ac adapter', 'ac charger', 'ac power', 'ac cable', 'ac cord', 'ac/dc', 'ac dc', 'kitchen knife', 'pocket knife', 'butter knife', 'knife set', 'knife block', 'power strip', 'surge protector', 'glue gun', 'nerf gun', 'massage gun', 'nail gun', 'water gun', 'squirt gun', 'gunmetal', 'gun metal', 'snake plant', 'rabbit vibrator', 'bunny ears', 'cat ears', 'dog walking', 'dog walk', 'dog sitting', 'pet sitting', 'cat sitting', 'toaster strudel', 'microwave safe', 'microwave-safe', 'microwavable', 'grill brush', 'grilled cheese', 'hair dresser', 'hairdresser', 'dresser mirror', 'loft bed kit', 'lofted bed kit', 'bed riser'] loop
    t := replace(t, phrase, ' ');
  end loop;
  return case
    when t ~* '(?:\y(?:air[ -]?con(?:ditioner|ditioning)?s?|a/c|ac|ac units?|window units?|portable ac)\y)' then 'air conditioner'
    when t ~* '(?:\ymicrowaves?\y)' then 'microwave'
    when t ~* '(?:\yhot[ -]?plates?\y)' then 'hot plate'
    when t ~* '(?:\ytoasters?(?: ovens?)?\y)' then 'toaster or toaster oven'
    when t ~* '(?:\y(?:electric (?:skillets?|griddles?)|george foreman|panini press|grills?)\y)' then 'electric skillet, griddle or grill'
    when t ~* '(?:\y(?:rice cookers?|pressure cookers?|instant ?pots?|multi-?cookers?)\y)' then 'rice cooker, pressure cooker or Instant Pot'
    when t ~* '(?:\y(?:space |electric |portable |room )?heaters?\y)' then 'space heater'
    when t ~* '(?:\y(?:dehumidifiers?|fog machines?|smoke machines?)\y)' then 'dehumidifier or fog machine'
    when t ~* '(?:\ycandles?\y)' then 'candle'
    when t ~* '(?:\y(?:incense|potpourri burners?|lava lamps?)\y)' then 'incense, potpourri burner or lava lamp'
    when t ~* '(?:\yextension cords?\y)' then 'extension cord'
    when t ~* '(?:\yceiling fans?\y)' then 'ceiling fan'
    when t ~* '(?:\y(?:guns?|rifles?|pistols?|firearms?|shotguns?|airsoft|bb guns?|paintball (?:guns?|markers?)|swords?|machetes?|daggers?|tasers?|stun guns?|pepper spray|crossbows?|brass knuckles|nunchucks?|throwing stars?|hunting kni(?:fe|ves)|switchblades?|butterfly kni(?:fe|ves))\y)' then 'weapon or replica weapon'
    when t ~* '(?:\y(?:fireworks?|firecrackers?|sparklers?|smoke bombs?|lighter fluid|charcoal|propane|gasoline|kerosene|butane)\y)' then 'fireworks or flammable fuel'
    when t ~* '(?:\y(?:security cameras?|surveillance cameras?|spy cameras?|hidden cameras?|nanny cams?|ring doorbells?|nest doorbells?|smart doorbells?|video doorbells?|doorbell cameras?)\y)' then 'security camera or smart doorbell'
    when t ~* '(?:\y(?:hamsters?|guinea pigs?|gerbils?|ferrets?|kittens?|puppies|puppy|bunny|bunnies|rabbits?|geckos?|bearded dragons?|parakeets?|snakes?|lizards?)\y)' then 'animal'
    when t ~* '(?:\y(?:lofts?|lofted|lofting)\y)' then 'loft'
    when t ~* '(?:\y(?:mattress(?:es)?|bed ?frames?|dressers?|sleeper sofas?|hide-?a-?beds?|futons?|sofa ?beds?|pull-?out couch(?:es)?|daybeds?|bunk beds?)\y)' then 'mattress, bed frame, dresser or sleeper sofa'
    when t ~* '(?:\y(?:waterbeds?|hot tubs?|kiddie pools?|inflatable pools?|swimming pools?)\y)' then 'waterbed, hot tub or pool'
    else null
  end;
end;
$$;
revoke all on function public.policy_match(text) from public, anon;
grant execute on function public.policy_match(text) to authenticated;

create or replace function public.products_policy_check()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  hit text;
begin
  if coalesce(new.listing_type, 'goods') = 'service' then
    return new;
  end if;
  hit := public.policy_match(coalesce(new.title, '') || ' ' || coalesce(new.description, ''));
  if hit is not null then
    if new.policy_flag is distinct from hit then
      new.policy_flag := hit;
      new.policy_flagged_at := now();
    end if;
  else
    new.policy_flag := null;
    new.policy_flagged_at := null;
  end if;
  return new;
end;
$$;
revoke all on function public.products_policy_check() from public, anon, authenticated;
drop trigger if exists trg_products_policy_check on public.products;
create trigger trg_products_policy_check
before insert or update of title, description, listing_type on public.products
for each row execute function public.products_policy_check();

create or replace function public.products_policy_notify()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  admin record;
begin
  if new.policy_flag is null or (tg_op = 'UPDATE' and old.policy_flag is not distinct from new.policy_flag) then
    return new;
  end if;
  insert into public.notifications (user_id, message, listing_id, is_read)
  values (new.seller_id,
          'Policy: your listing "' || left(coalesce(new.title, ''), 60) || '" is hidden because ' || new.policy_flag || ' is prohibited in Denison housing. Edit the title and description to re-list it.',
          new.id, false);
  for admin in select user_id from public.admin_users loop
    if admin.user_id <> new.seller_id then
      insert into public.notifications (user_id, message, listing_id, is_read)
      values (admin.user_id, 'Policy: listing "' || left(coalesce(new.title, ''), 60) || '" hidden (' || new.policy_flag || ').', new.id, false);
    end if;
  end loop;
  return new;
end;
$$;
revoke all on function public.products_policy_notify() from public, anon, authenticated;
drop trigger if exists trg_products_policy_notify on public.products;
create trigger trg_products_policy_notify
after insert or update of policy_flag on public.products
for each row execute function public.products_policy_notify();

-- Hide flagged listings from everyone except the seller and admins.
drop policy if exists "products_select_campus" on public.products;
create policy "products_select_campus"
on public.products
for select
to authenticated
using (
  school_id = public.current_school_id()
  and (
    policy_flag is null
    or seller_id = auth.uid()
    or exists (select 1 from public.admin_users a where a.user_id = auth.uid())
  )
);

-- One-time sweep: re-run the check on every existing goods listing.
update public.products
set title = title
where coalesce(listing_type, 'goods') <> 'service'
  and public.policy_match(coalesce(title, '') || ' ' || coalesce(description, '')) is distinct from policy_flag;
