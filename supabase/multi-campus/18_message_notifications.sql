-- 18: Notify the receiver of a chat message when they are not in the app.
-- Idempotent. Pairs with 07 (Resend via pg_net + Vault) and 17 (chat RLS).
--
--  * Bell: one in-app notification per conversation per 10 minutes.
--  * Email: one email per conversation per hour (Resend key from Vault;
--    silently skipped if the key is missing). Never blocks the message insert.

create extension if not exists pg_net;

create table if not exists public.message_email_log (
  conversation_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  last_sent_at timestamptz not null default now(),
  primary key (conversation_id, user_id)
);
alter table public.message_email_log enable row level security; -- server-only

create or replace function public.notify_new_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sender_name text;
  v_title text;
  v_listing uuid;
  v_email text;
  v_api_key text;
  v_msg text;
  v_preview text;
begin
  if new.receiver_id is null or new.receiver_id = new.sender_id then
    return new;
  end if;

  select coalesce(nullif(trim(p.name), ''), 'A student') into v_sender_name
  from public.profiles p where p.id = new.sender_id;
  v_sender_name := coalesce(v_sender_name, 'A student');

  if new.product_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    v_listing := new.product_id::uuid;
    select title into v_title from public.products where id = v_listing;
  end if;

  v_msg := case when v_title is not null
    then format('New message from %s about "%s". Open Messages to reply.', v_sender_name, v_title)
    else format('New message from %s. Open Messages to reply.', v_sender_name) end;

  -- 1) Bell (throttled: skip if an unread message notification for this
  --    sender/listing already landed in the last 10 minutes)
  begin
    if not exists (
      select 1 from public.notifications n
      where n.user_id = new.receiver_id
        and n.is_read = false
        and n.message like 'New message from ' || v_sender_name || '%'
        and n.listing_id is not distinct from v_listing
        and n.created_at > now() - interval '10 minutes'
    ) then
      insert into public.notifications (user_id, message, listing_id, is_read)
      values (new.receiver_id, v_msg, v_listing, false);
    end if;
  exception when others then
    raise notice '[DormGlide] message bell failed: %', sqlerrm;
  end;

  -- 2) Email (throttled per conversation per hour)
  begin
    select decrypted_secret into v_api_key
    from vault.decrypted_secrets where name = 'resend_api_key' limit 1;
  exception when others then
    v_api_key := null;
  end;
  if v_api_key is null then return new; end if;

  if exists (
    select 1 from public.message_email_log l
    where l.conversation_id = new.conversation_id and l.user_id = new.receiver_id
      and l.last_sent_at > now() - interval '1 hour'
  ) then
    return new;
  end if;

  select u.email into v_email from auth.users u where u.id = new.receiver_id;
  if v_email is null then return new; end if;

  v_preview := replace(replace(left(coalesce(new.body, ''), 140), '<', '&lt;'), '>', '&gt;');
  if length(coalesce(new.body, '')) > 140 then v_preview := v_preview || '…'; end if;

  begin
    perform net.http_post(
      url := 'https://api.resend.com/emails',
      headers := jsonb_build_object(
        'Authorization', 'Bearer ' || v_api_key,
        'Content-Type', 'application/json'
      ),
      body := jsonb_build_object(
        'from', 'DormGlide <noreply@dormglide.com>',
        'to', v_email,
        'subject', case when v_title is not null
          then format('DormGlide: new message from %s about "%s"', v_sender_name, v_title)
          else format('DormGlide: new message from %s', v_sender_name) end,
        'html', format(
          '<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px">' ||
          '<h2 style="color:#2563eb;margin:0 0 12px">You have a new message</h2>' ||
          '<p style="color:#374151"><strong>%s</strong>%s wrote:</p>' ||
          '<div style="background:#eff6ff;border:1px solid #bfdbfe;padding:16px;border-radius:10px;margin:16px 0;color:#1f2937">%s</div>' ||
          '<a href="https://dormglide.com/app.html" style="background:#2563eb;color:#fff;padding:12px 28px;border-radius:50px;text-decoration:none;display:inline-block;margin-top:8px;font-weight:bold">Open Messages</a>' ||
          '<p style="color:#9ca3af;font-size:12px;margin-top:24px">You get at most one email per conversation per hour. Reply in the app — never pay before you meet.</p>' ||
          '</div>',
          replace(replace(v_sender_name, '<', '&lt;'), '>', '&gt;'),
          case when v_title is not null then ' (about ' || replace(replace(v_title, '<', '&lt;'), '>', '&gt;') || ')' else '' end,
          v_preview
        )
      )
    );
    insert into public.message_email_log (conversation_id, user_id, last_sent_at)
    values (new.conversation_id, new.receiver_id, now())
    on conflict (conversation_id, user_id) do update set last_sent_at = now();
  exception when others then
    raise notice '[DormGlide] message email failed: %', sqlerrm;
  end;

  return new;
end;
$$;

-- Hardening rule (migration 15): internal trigger functions are not callable via RPC.
revoke all on function public.notify_new_message() from public, anon, authenticated;

drop trigger if exists trg_messages_notify on public.messages;
create trigger trg_messages_notify
after insert on public.messages
for each row execute function public.notify_new_message();
