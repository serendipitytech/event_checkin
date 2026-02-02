-- RPC function for creating event access codes
-- Called from the client app by managers/admins to generate shareable codes

-- Function to create a new access code for an event
create or replace function public.create_event_access_code(
  p_event_id uuid,
  p_code_hash text,
  p_role text default 'checker',
  p_expires_at timestamptz default null,
  p_max_uses int default null,
  p_note text default null
)
returns public.event_access_codes
language plpgsql
security definer
as $$
declare
  v_code_record public.event_access_codes;
begin
  -- Verify caller has manager or admin role on the event
  if not public.is_event_admin_or_manager(p_event_id) then
    raise exception 'Unauthorized: must be event manager or admin';
  end if;

  -- Validate role parameter
  if p_role not in ('checker', 'manager') then
    raise exception 'Invalid role: must be checker or manager';
  end if;

  -- Insert the new code
  insert into public.event_access_codes (
    event_id,
    code_hash,
    role,
    expires_at,
    max_uses,
    note,
    created_by
  ) values (
    p_event_id,
    p_code_hash,
    p_role,
    p_expires_at,
    p_max_uses,
    p_note,
    auth.uid()
  )
  returning * into v_code_record;

  return v_code_record;
end;
$$;

-- Function to revoke (disable) an access code
create or replace function public.revoke_event_access_code(p_code_id uuid)
returns boolean
language plpgsql
security definer
as $$
declare
  v_event_id uuid;
begin
  -- Get the event_id for this code
  select event_id into v_event_id
  from public.event_access_codes
  where id = p_code_id;

  if v_event_id is null then
    raise exception 'Code not found';
  end if;

  -- Verify caller has manager or admin role on the event
  if not public.is_event_admin_or_manager(v_event_id) then
    raise exception 'Unauthorized: must be event manager or admin';
  end if;

  -- Disable the code
  update public.event_access_codes
  set disabled = true
  where id = p_code_id;

  return true;
end;
$$;

-- Function to list access codes for an event (with redemption counts)
create or replace function public.list_event_access_codes(p_event_id uuid)
returns table (
  id uuid,
  event_id uuid,
  role text,
  expires_at timestamptz,
  max_uses int,
  used_count int,
  single_device boolean,
  disabled boolean,
  note text,
  created_at timestamptz,
  created_by uuid,
  redemption_count bigint
)
language plpgsql
security definer
stable
as $$
begin
  -- Verify caller has manager or admin role on the event
  if not public.is_event_admin_or_manager(p_event_id) then
    raise exception 'Unauthorized: must be event manager or admin';
  end if;

  return query
  select
    c.id,
    c.event_id,
    c.role,
    c.expires_at,
    c.max_uses,
    c.used_count,
    c.single_device,
    c.disabled,
    c.note,
    c.created_at,
    c.created_by,
    count(r.id)::bigint as redemption_count
  from public.event_access_codes c
  left join public.event_code_redemptions r on r.code_id = c.id
  where c.event_id = p_event_id
  group by c.id
  order by c.created_at desc;
end;
$$;

-- Function to get redemptions for a specific code (audit trail)
create or replace function public.get_code_redemptions(p_code_id uuid)
returns table (
  id uuid,
  user_id uuid,
  client_instance_id text,
  created_at timestamptz
)
language plpgsql
security definer
stable
as $$
declare
  v_event_id uuid;
begin
  -- Get the event_id for this code
  select event_id into v_event_id
  from public.event_access_codes
  where id = p_code_id;

  if v_event_id is null then
    raise exception 'Code not found';
  end if;

  -- Verify caller has manager or admin role on the event
  if not public.is_event_admin_or_manager(v_event_id) then
    raise exception 'Unauthorized: must be event manager or admin';
  end if;

  return query
  select
    r.id,
    r.user_id,
    r.client_instance_id,
    r.created_at
  from public.event_code_redemptions r
  where r.code_id = p_code_id
  order by r.created_at desc;
end;
$$;
