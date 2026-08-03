-- Add admin access support via Supabase user metadata
-- This creates a helper function to check whether a user is an admin.

create or replace function public.is_admin_user(user_id uuid)
returns boolean
language sql
as $$
  select exists (
    select 1
    from auth.users au
    where au.id = user_id
      and (
        coalesce(au.raw_app_meta_data->>'isAdmin', '') = 'true'
        or coalesce(au.raw_user_meta_data->>'isAdmin', '') = 'true'
      )
  );
$$;

comment on function public.is_admin_user(uuid) is 'Returns true when a Supabase auth user has isAdmin set to true in app metadata or user metadata.';
