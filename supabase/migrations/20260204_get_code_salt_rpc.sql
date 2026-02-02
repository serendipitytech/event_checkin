-- Create a simple RPC to fetch the code salt from Vault
-- This allows the edge function to access the salt via supabase.rpc()

create or replace function public.get_code_salt()
returns text
language plpgsql
security definer
as $$
declare
  v_salt text;
begin
  select decrypted_secret into v_salt
  from vault.decrypted_secrets
  where name = 'code_salt'
  limit 1;

  if v_salt is null or v_salt = '' then
    raise exception 'CODE_SALT not configured in Vault';
  end if;

  return v_salt;
end;
$$;

-- Restrict access to service role only (edge functions use service role)
revoke execute on function public.get_code_salt() from public;
revoke execute on function public.get_code_salt() from anon;
revoke execute on function public.get_code_salt() from authenticated;

comment on function public.get_code_salt() is
  'Fetches the code salt from Vault. Restricted to service role only.';
