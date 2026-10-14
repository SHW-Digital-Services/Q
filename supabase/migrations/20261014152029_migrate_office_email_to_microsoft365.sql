-- Microsoft Graph message and folder IDs are opaque strings, unlike Zoho's numeric IDs.
-- Keep provider message bodies out of the CRM and preserve old Zoho history unchanged.
create or replace function public.log_office_customer_email(
 p_user uuid,p_email text,p_inbound boolean,p_account text,p_folder text,p_message text,p_subject text,p_received timestamptz
) returns uuid language plpgsql security invoker set search_path='' as $$
declare ticket_id uuid; mail_id uuid; mail_key text := p_account||':'||p_message;
begin
 if p_user is null or p_email is null or p_inbound is null
   or p_account !~ '^[0-9]{1,30}$'
   or p_folder !~ '^[A-Za-z0-9_+=.-]{1,500}$'
   or p_message !~ '^[A-Za-z0-9_+=.-]{1,500}$'
 then raise exception 'CRM_EMAIL_INVALID'; end if;
 -- The server resolves this identity from Supabase Auth, never from client-supplied email.
 if p_inbound then
  insert into public.contact_requests(user_id,email,name,category,subject,message,guest_access,email_key,email_account_id,email_folder_id,email_message_id,created_at,updated_at)
  values(p_user,p_email,null,'general',left('Email: '||coalesce(nullif(p_subject,''),'Customer email'),160),'Email received by office@q-ai.online. Open the linked office email to read the message and send an email reply.',false,mail_key,p_account,p_folder,p_message,coalesce(p_received,now()),coalesce(p_received,now()))
  on conflict(email_key) do nothing returning id into ticket_id;
  if ticket_id is not null then insert into public.support_events(request_id,action,status) values(ticket_id,'created','new');
  else select id into ticket_id from public.contact_requests where email_key=mail_key and user_id=p_user;
   if ticket_id is null then raise exception 'CRM_EMAIL_IDENTITY_CONFLICT'; end if;
   update public.contact_requests set email_folder_id=p_folder where id=ticket_id;
  end if;
 end if;
 insert into public.crm_communications(user_id,contact_request_id,direction,channel,status,sender_email,recipient_email,subject,body,external_source,external_id,metadata,created_at)
 values(p_user,ticket_id,case when p_inbound then 'inbound' else 'outbound' end,'email',case when p_inbound then 'logged' else 'sent' end,case when p_inbound then p_email else 'office@q-ai.online' end,case when p_inbound then 'office@q-ai.online' else p_email end,left(coalesce(p_subject,'Customer email'),160),'Email held privately in Microsoft 365. Open the linked office email to read it.','microsoft365_office',mail_key,jsonb_build_object('accountId',p_account,'folderId',p_folder,'messageId',p_message),coalesce(p_received,now()))
 on conflict(user_id,external_source,external_id) do update set metadata=excluded.metadata returning id into mail_id;
 return mail_id;
end $$;
revoke all on function public.log_office_customer_email(uuid,text,boolean,text,text,text,text,timestamptz) from public,anon,authenticated;
grant execute on function public.log_office_customer_email(uuid,text,boolean,text,text,text,text,timestamptz) to service_role;
