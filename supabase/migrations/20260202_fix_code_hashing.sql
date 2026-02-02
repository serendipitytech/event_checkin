-- Fix: Update create_event_access_code to accept plain code and hash server-side
-- The CODE_SALT must be stored in a database setting that the function can access

-- First, create a helper function to hash codes with the salt
-- NOTE: This requires the pgcrypto extension which should already be enabled
create or replace function public.hash_access_code(p_plain_code text)
returns text
language plpgsql
security definer
as $$
declare
  v_salt text;
  v_normalized text;
begin
  -- Get the salt from database settings
  -- Must be configured via: ALTER DATABASE postgres SET app.code_salt = 'your-salt';
  v_salt := current_setting('app.code_salt', true);

  if v_salt is null or v_salt = '' then
    raise exception 'CODE_SALT not configured. Set it via: ALTER DATABASE postgres SET app.code_salt = ''your-salt'';';
  end if;

  -- Normalize: uppercase and remove whitespace/dashes
  v_normalized := upper(regexp_replace(p_plain_code, '[\s-]+', '', 'g'));

  -- Hash with salt prefix (same format as edge function)
  return encode(digest(v_salt || '|' || v_normalized, 'sha256'), 'hex');
end;
$$;

-- Drop existing function to allow parameter rename
drop function if exists public.create_event_access_code(uuid, text, text, timestamptz, int, text);

-- Recreate create_event_access_code to accept plain code instead of hash
create function public.create_event_access_code(
  p_event_id uuid,
  p_plain_code text,  -- Now accepts plain code, not hash
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
  v_code_hash text;
begin
  -- Verify caller has manager or admin role on the event
  if not public.is_event_admin_or_manager(p_event_id) then
    raise exception 'Unauthorized: must be event manager or admin';
  end if;

  -- Validate role parameter
  if p_role not in ('checker', 'manager') then
    raise exception 'Invalid role: must be checker or manager';
  end if;

  -- Validate code length
  if length(regexp_replace(p_plain_code, '[\s-]+', '', 'g')) < 4 then
    raise exception 'Code must be at least 4 characters';
  end if;

  -- Hash the code server-side with the salt
  v_code_hash := public.hash_access_code(p_plain_code);

  -- Check for duplicate hash
  if exists (select 1 from public.event_access_codes where code_hash = v_code_hash) then
    raise exception 'A code with this value already exists';
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
    v_code_hash,
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

-- Add a comment explaining the salt configuration requirement
comment on function public.hash_access_code(text) is
  'Hashes an access code with the configured salt. Requires app.code_salt to be set via ALTER DATABASE SET.';

comment on function public.create_event_access_code(uuid, text, text, timestamptz, int, text) is
  'Creates an access code for an event. Accepts plain code which is hashed server-side with salt.';
