-- DATA MODEL SCRIPTS
-- Organizations (tenants)
create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

-- Users join orgs with roles
-- role: 'owner' | 'admin' | 'member'
create table public.organization_members (
  org_id uuid references public.organizations(id) on delete cascade,
  user_id uuid not null, -- auth.users.id
  role text not null check (role in ('owner','admin','member')),
  created_at timestamptz not null default now(),
  primary key (org_id, user_id)
);

-- Events belong to an org
create table public.events (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  starts_at timestamptz,
  ends_at timestamptz,
  join_code text unique,             -- optional: short code for kiosk/device
  created_by uuid,                   -- user_id
  created_at timestamptz not null default now()
);

-- Optional per-event role (useful if you want to invite helpers who aren’t org members)
-- role: 'manager' | 'checker'
create table public.event_members (
  event_id uuid references public.events(id) on delete cascade,
  user_id uuid not null,
  role text not null check (role in ('manager','checker')),
  created_at timestamptz not null default now(),
  primary key (event_id, user_id)
);

-- Attendees per event
create table public.attendees (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  full_name text not null,
  group_name text,       -- e.g., "Rising Star"
  table_number text,     -- string to allow "5A", etc.
  ticket_type text,
  notes text,
  checked_in boolean not null default false,
  checked_in_at timestamptz,
  checked_in_by uuid,    -- user_id
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Simple invitations (email + token) to onboard to an org
-- accepted_at set when user redeems
create table public.org_invites (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  email text not null,
  role text not null check (role in ('admin','member')),
  token text not null unique,
  created_by uuid,
  created_at timestamptz not null default now(),
  accepted_at timestamptz
);

-- Storage for uploads (CSV/XLSX). Create bucket via UI: 'imports'
-- We'll set Storage policies later.

-- INDEXES
create index on public.events (org_id);
create index on public.attendees (event_id, checked_in);
create index on public.organization_members (user_id);
create index on public.event_members (user_id);

--RLS 
alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;
alter table public.events enable row level security;
alter table public.event_members enable row level security;
alter table public.attendees enable row level security;
alter table public.org_invites enable row level security;

--Helpers - views for policies
-- What orgs does the current user belong to?
create or replace view public.my_orgs as
select om.org_id
from public.organization_members om
where om.user_id = auth.uid();

-- What events can current user access? (org member OR explicit event member)
create or replace view public.my_events as
select e.id as event_id
from public.events e
where e.org_id in (select org_id from public.my_orgs)
union
select em.event_id from public.event_members em where em.user_id = auth.uid();

--POLICIES
-- organization_members: a user can see their memberships; org owners/admins manage membership
create policy "org_members_select_self"
  on public.organization_members for select
  using (user_id = auth.uid()
     or org_id in (select org_id from public.my_orgs));

-- Only owners/admins of that org can insert/update/delete membership rows
create policy "org_members_manage_by_admins"
  on public.organization_members for all
  using (
    org_id in (select org_id from public.my_orgs)
    and exists (
      select 1 from public.organization_members m
      where m.org_id = organization_members.org_id
        and m.user_id = auth.uid()
        and m.role in ('owner','admin')
    )
  )
  with check (true);

-- organizations: visible to members; mutable by owners/admins
create policy "orgs_select_by_members"
  on public.organizations for select
  using (id in (select org_id from public.my_orgs));

create policy "orgs_update_by_admins"
  on public.organizations for update
  using (
    id in (select org_id from public.my_orgs)
    and exists (
      select 1 from public.organization_members m
      where m.org_id = organizations.id
        and m.user_id = auth.uid()
        and m.role in ('owner','admin')
    )
  );

-- events: visible to org members or event members; created by org admins
create policy "events_select_by_access"
  on public.events for select
  using (id in (select event_id from public.my_events));

create policy "events_insert_by_org_admins"
  on public.events for insert
  with check (
    org_id in (select org_id from public.my_orgs)
    and exists (
      select 1 from public.organization_members m
      where m.org_id = events.org_id
        and m.user_id = auth.uid()
        and m.role in ('owner','admin')
    )
  );

create policy "events_update_by_org_admins"
  on public.events for update
  using (
    id in (select event_id from public.my_events)
    and exists (
      select 1 from public.organization_members m
      where m.org_id = events.org_id
        and m.user_id = auth.uid()
        and m.role in ('owner','admin')
    )
  );

-- event_members: visible to event members; manageable by org admins or event managers
create policy "event_members_select_by_access"
  on public.event_members for select
  using (event_id in (select event_id from public.my_events));

create policy "event_members_manage_by_admins_or_mgrs"
  on public.event_members for all
  using (
    event_id in (select event_id from public.my_events)
    and (
      exists (
        select 1 from public.organization_members m
        join public.events e on e.org_id = m.org_id
        where e.id = event_members.event_id
          and m.user_id = auth.uid()
          and m.role in ('owner','admin')
      )
      or exists (
        select 1 from public.event_members em
        where em.event_id = event_members.event_id
          and em.user_id = auth.uid()
          and em.role = 'manager'
      )
    )
  ) with check (true);

-- attendees: readable by anyone with access to the event; updates allowed to same
create policy "attendees_select_by_access"
  on public.attendees for select
  using (event_id in (select event_id from public.my_events));

-- Who can modify attendees? org admins or event managers; 'checker' can update check-in fields
create policy "attendees_insert_by_admins_or_mgrs"
  on public.attendees for insert
  with check (
    event_id in (select event_id from public.my_events)
    and (
      exists (
        select 1 from public.organization_members m
        join public.events e on e.org_id = m.org_id
        where e.id = attendees.event_id
          and m.user_id = auth.uid()
          and m.role in ('owner','admin')
      )
      or exists (
        select 1 from public.event_members em
        where em.event_id = attendees.event_id
          and em.user_id = auth.uid()
          and em.role = 'manager'
      )
    )
  );

-- Update: admins/managers can edit any fields; 'checker' may only toggle check-in columns
create policy "attendees_update_by_role"
  on public.attendees for update
  using (event_id in (select event_id from public.my_events))
  with check (
    -- allow if admin/manager
    exists (
      select 1 from public.organization_members m
      join public.events e on e.org_id = m.org_id
      where e.id = attendees.event_id
        and m.user_id = auth.uid()
        and m.role in ('owner','admin')
    )
    or exists (
      select 1 from public.event_members em
      where em.event_id = attendees.event_id
        and em.user_id = auth.uid()
        and em.role = 'manager'
    )
    -- or checker updating only check-in fields
    or (
      exists (
        select 1 from public.event_members em
        where em.event_id = attendees.event_id
          and em.user_id = auth.uid()
          and em.role = 'checker'
      )
      and (
        -- enforce only check-in columns changed
        (attendees IS NOT DISTINCT FROM attendees) -- placeholder; see note below
      )
    )
  );
  
--️ Note on “only specific columns”: Postgres RLS can’t directly diff “old vs new” columns. Enforce this with:
-- •	a BEFORE UPDATE trigger that rejects changes to non-check-in fields when the updater is only a checker, or
-- •	route check-in toggles through a SECURITY DEFINER function that only touches allowed columns.

--For invites
create policy "invites_select_for_creator_and_org_admins"
  on public.org_invites for select
  using (
    org_id in (select org_id from public.my_orgs)
  );

-- Inserts allowed by org admins/owners
create policy "invites_insert_by_admins"
  on public.org_invites for insert
  with check (
    org_id in (select org_id from public.my_orgs)
    and exists (
      select 1 from public.organization_members m
      where m.org_id = org_invites.org_id
        and m.user_id = auth.uid()
        and m.role in ('owner','admin')
    )
  );
  
-- Helper for Auth to get access
create or replace function public.get_my_access()
returns table (
  org_id uuid,
  org_name text,
  event_id uuid,
  event_name text,
  role text
) language sql stable security definer
set search_path = public
as $$
  select
    o.id as org_id,
    o.name as org_name,
    e.id as event_id,
    e.name as event_name,
    -- Decide role:
    coalesce(
      -- If event_membership exists, use that role
      (select em.role
         from public.event_members em
        where em.event_id = e.id
          and em.user_id = auth.uid()
        limit 1),
      -- Otherwise fall back to org role
      (select m.role
         from public.organization_members m
        where m.org_id = o.id
          and m.user_id = auth.uid()
        limit 1)
    ) as role
  from public.events e
  join public.organizations o on o.id = e.org_id
  where e.id in (select event_id from public.my_events)
  order by o.name, e.starts_at nulls first;
$$;

--CSV/XLSX Imports
create or replace function public.upsert_attendees(
  p_event_id uuid,
  p_rows jsonb
) returns void
language plpgsql security definer
as $$
begin
  -- authorization: require access to this event
  if not exists (
    select 1 from public.my_events where event_id = p_event_id
  ) then
    raise exception 'No access to event';
  end if;

  -- p_rows: jsonb array of objects {full_name, group_name, table_number, ticket_type, notes}
  insert into public.attendees (event_id, full_name, group_name, table_number, ticket_type, notes)
  select p_event_id,
         (row->>'full_name'),
         nullif(row->>'group_name',''),
         nullif(row->>'table_number',''),
         nullif(row->>'ticket_type',''),
         nullif(row->>'notes','')
  from jsonb_array_elements(p_rows) as row
  on conflict (event_id, full_name) do update
    set group_name = excluded.group_name,
        table_number = excluded.table_number,
        ticket_type = excluded.ticket_type,
        notes = excluded.notes,
        updated_at = now();
end;
$$;

--Gesture/confirmations
-- Toggle a single attendee (used by swipe/double-tap + modal confirm)
create or replace function public.toggle_checkin(p_attendee_id uuid, p_checked boolean)
returns void
language sql security definer
as $$
  update public.attendees
  set checked_in = p_checked,
      checked_in_at = case when p_checked then now() else null end,
      checked_in_by = case when p_checked then auth.uid() else null end,
      updated_at = now()
  where id = p_attendee_id
    and event_id in (select event_id from public.my_events);
$$;

-- Bulk check-in by table
create or replace function public.bulk_checkin_by_table(p_event_id uuid, p_table text, p_checked boolean)
returns integer
language sql security definer
as $$
  update public.attendees
  set checked_in = p_checked,
      checked_in_at = case when p_checked then now() else null end,
      checked_in_by = case when p_checked then auth.uid() else null end,
      updated_at = now()
  where event_id = p_event_id
    and table_number = p_table
    and event_id in (select event_id from public.my_events);
  select count(*) from public.attendees
  where event_id = p_event_id and table_number = p_table and checked_in = p_checked;
$$;

-- Bulk by group
create or replace function public.bulk_checkin_by_group(p_event_id uuid, p_group text, p_checked boolean)
returns integer
language sql security definer
as $$
  update public.attendees
  set checked_in = p_checked,
      checked_in_at = case when p_checked then now() else null end,
      checked_in_by = case when p_checked then auth.uid() else null end,
      updated_at = now()
  where event_id = p_event_id
    and group_name = p_group
    and event_id in (select event_id from public.my_events);
  select count(*) from public.attendees
  where event_id = p_event_id and group_name = p_group and checked_in = p_checked;
$$;