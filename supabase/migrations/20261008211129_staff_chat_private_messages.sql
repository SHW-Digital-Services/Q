alter table public.staff_chat_messages
  add column recipient_id uuid references public.profiles(id) on delete restrict;
alter table public.staff_chat_messages
  add constraint staff_chat_distinct_recipient check (recipient_id is null or recipient_id <> user_id);
create index staff_chat_messages_recipient_idx on public.staff_chat_messages(recipient_id, id);
create index staff_chat_messages_sender_idx on public.staff_chat_messages(user_id, id);
