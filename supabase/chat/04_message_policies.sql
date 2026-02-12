-- Read: sender or receiver can read
create policy "messages_select_participants"
on public.messages
for select
to authenticated
using (auth.uid() = sender_id or auth.uid() = receiver_id);

-- Insert: sender must be the logged-in user
create policy "messages_insert_sender"
on public.messages
for insert
to authenticated
with check (auth.uid() = sender_id);
