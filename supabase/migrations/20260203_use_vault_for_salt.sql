-- Use Supabase Vault for CODE_SALT instead of database settings
-- Vault is the proper way to store secrets in Supabase

-- Update hash_access_code to read from Vault
create or replace function public.hash_access_code(p_plain_code text)
returns text
language plpgsql
security definer
as $$
declare
  v_salt text;
  v_normalized text;
begin
  -- Get the salt from Vault
  select decrypted_secret into v_salt
  from vault.decrypted_secrets
  where name = 'code_salt'
  limit 1;

  if v_salt is null or v_salt = '' then
    raise exception 'CODE_SALT not configured in Vault. Add it via: SELECT vault.create_secret(''your-salt-here'', ''code_salt'');';
  end if;

  -- Normalize: uppercase and remove whitespace/dashes
  v_normalized := upper(regexp_replace(p_plain_code, '[\s-]+', '', 'g'));

  -- Hash with salt prefix (same format as edge function)
  return encode(digest(v_salt || '|' || v_normalized, 'sha256'), 'hex');
end;
$$;

-- Update comment
comment on function public.hash_access_code(text) is
  'Hashes an access code with the salt from Vault. Requires code_salt secret in vault.decrypted_secrets.';
