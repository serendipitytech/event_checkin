-- Event Access Codes and Redemptions
-- Provides code-based access to events without email magic links.

-- Enable pgcrypto for gen_random_uuid if not enabled
create extension if not exists pgcrypto;

-- 1) Codes table (hashed codes)
create table if not exists public.event_access_codes (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  code_hash text not null unique,
  role text not null check (role in ('checker','manager','admin')),
  expires_at timestamptz,
  max_uses int,
  used_count int not null default 0,
  single_device boolean not null default false,
  disabled boolean not null default false,
  created_by uuid references auth.users(id),
  note text,
  created_at timestamptz not null default now()
);

create index if not exists idx_event_access_codes_event on public.event_access_codes(event_id);
create index if not exists idx_event_access_codes_hash on public.event_access_codes(code_hash);

-- 2) Redemptions audit table
create table if not exists public.event_code_redemptions (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  code_id uuid not null references public.event_access_codes(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  client_instance_id text,
  created_at timestamptz not null default now(),
  unique (code_id, user_id)
);

create index if not exists idx_event_code_redemptions_event on public.event_code_redemptions(event_id);
create index if not exists idx_event_code_redemptions_user on public.event_code_redemptions(user_id);

-- 3) Enable RLS
alter table public.event_access_codes enable row level security;
alter table public.event_code_redemptions enable row level security;

-- 4) Increment helper (used by Edge Function)
create or replace function public.http_increment_code_use(p_code_id uuid)
returns void
language plpgsql
as $$
begin
  update public.event_access_codes
     set used_count = used_count + 1
   where id = p_code_id
     and (max_uses is null or used_count < max_uses);
end;
$$;

-- Helper: check if current user is admin/manager for the event
-- Uses existing event_members table (role column).
create or replace function public.is_event_admin_or_manager(p_event_id uuid)
returns boolean language sql stable as $$
  select exists (
    select 1
    from public.event_members em
    where em.event_id = p_event_id
      and em.user_id = auth.uid()
      and em.role in ('admin','manager')
  );
$$;

-- Policies for event_access_codes
drop policy if exists codes_select_by_admins on public.event_access_codes;
create policy codes_select_by_admins
  on public.event_access_codes for select
  using (public.is_event_admin_or_manager(event_id));

drop policy if exists codes_manage_by_admins on public.event_access_codes;
create policy codes_manage_by_admins
  on public.event_access_codes for all
  using (public.is_event_admin_or_manager(event_id))
  with check (public.is_event_admin_or_manager(event_id));

-- Policies for event_code_redemptions
drop policy if exists redemptions_select_self_or_admins on public.event_code_redemptions;
create policy redemptions_select_self_or_admins
  on public.event_code_redemptions for select
  using (
    user_id = auth.uid() or public.is_event_admin_or_manager(event_id)
  );

drop policy if exists redemptions_manage_by_admins on public.event_code_redemptions;
create policy redemptions_manage_by_admins
  on public.event_code_redemptions for all
  using (public.is_event_admin_or_manager(event_id))
  with check (public.is_event_admin_or_manager(event_id));
