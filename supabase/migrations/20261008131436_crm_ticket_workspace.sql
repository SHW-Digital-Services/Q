-- Office email metadata is private CRM data; bodies/attachments remain in Zoho.
alter table public.contact_requests add column due_at timestamptz,
 add column priority text not null default 'normal' check(priority in ('low','normal','high','urgent')),
 add column email_key text unique, add column email_account_id text, add column email_folder_id text, add column email_message_id text;
create index contact_requests_due_idx on public.contact_requests(due_at,id) where archived_at is null and status not in ('resolved','closed');
alter table public.crm_communications add column external_source text, add column external_id text;
create unique index crm_communications_external_idx on public.crm_communications(user_id,external_source,external_id);
alter table public.support_events drop constraint support_events_action_check;
alter table public.support_events add constraint support_events_action_check check(action in ('created','reply','note','status','assignment','archive','restore','due','priority'));
create function public.schedule_support_ticket(p_request uuid,p_actor uuid,p_action text,p_due timestamptz default null,p_priority text default null)
returns void language plpgsql security invoker set search_path='' as $$
declare ticket public.contact_requests;
begin
 select * into ticket from public.contact_requests where id=p_request for update;
 if ticket.id is null then raise exception 'SUPPORT_NOT_FOUND'; end if;
 if p_action='due' then update public.contact_requests set due_at=p_due,updated_at=now() where id=p_request;
 elsif p_action='priority' and p_priority in ('low','normal','high','urgent') then update public.contact_requests set priority=p_priority,updated_at=now() where id=p_request;
 else raise exception 'SUPPORT_INVALID';end if;
 insert into public.support_events(request_id,actor_id,action,status,assigned_to) values(p_request,p_actor,p_action,ticket.status,ticket.assigned_to);
end $$;
revoke all on function public.schedule_support_ticket(uuid,uuid,text,timestamptz,text) from public,anon,authenticated;
grant execute on function public.schedule_support_ticket(uuid,uuid,text,timestamptz,text) to service_role;
create function public.log_office_customer_email(p_user uuid,p_email text,p_inbound boolean,p_account text,p_folder text,p_message text,p_subject text,p_received timestamptz)
returns uuid language plpgsql security invoker set search_path='' as $$
declare ticket_id uuid; mail_id uuid; mail_key text := p_account||':'||p_message;
begin
 if p_user is null or p_email is null or p_inbound is null or p_account !~ '^[0-9]{1,30}$' or p_folder !~ '^[0-9]{1,30}$' or p_message !~ '^[0-9]{1,30}$' then raise exception 'CRM_EMAIL_INVALID';end if;
 -- The server resolves this identity from Supabase Auth, never from client-supplied email.
 if p_inbound then
  insert into public.contact_requests(user_id,email,name,category,subject,message,guest_access,email_key,email_account_id,email_folder_id,email_message_id,created_at,updated_at)
  values(p_user,p_email,null,'general',left('Email: '||coalesce(nullif(p_subject,''),'Customer email'),160),'Email received by office@q-ai.online. Open the linked office email to read the message and send an email reply.',false,mail_key,p_account,p_folder,p_message,coalesce(p_received,now()),coalesce(p_received,now()))
  on conflict(email_key) do nothing returning id into ticket_id;
  if ticket_id is not null then insert into public.support_events(request_id,action,status) values(ticket_id,'created','new');
  else select id into ticket_id from public.contact_requests where email_key=mail_key and user_id=p_user;
   if ticket_id is null then raise exception 'CRM_EMAIL_IDENTITY_CONFLICT';end if;
   update public.contact_requests set email_folder_id=p_folder where id=ticket_id;
  end if;
 end if;
 insert into public.crm_communications(user_id,contact_request_id,direction,channel,status,sender_email,recipient_email,subject,body,external_source,external_id,metadata,created_at)
 values(p_user,ticket_id,case when p_inbound then 'inbound' else 'outbound' end,'email',case when p_inbound then 'logged' else 'sent' end,case when p_inbound then p_email else 'office@q-ai.online' end,case when p_inbound then 'office@q-ai.online' else p_email end,left(coalesce(p_subject,'Customer email'),160),'Email held privately in Zoho. Open the linked email to read it.','zoho_office',mail_key,jsonb_build_object('accountId',p_account,'folderId',p_folder,'messageId',p_message),coalesce(p_received,now()))
 on conflict(user_id,external_source,external_id) do update set metadata=excluded.metadata returning id into mail_id;
 return mail_id;
end $$;
revoke all on function public.log_office_customer_email(uuid,text,boolean,text,text,text,text,timestamptz) from public,anon,authenticated;
grant execute on function public.log_office_customer_email(uuid,text,boolean,text,text,text,text,timestamptz) to service_role;
