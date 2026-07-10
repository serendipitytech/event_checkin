-- Post-migration setup for a freshly rebuilt Expo Checkin project.
-- Run AFTER `supabase db push` has applied all migrations.
-- Purpose: enable Vault, store the code_salt secret, and enable realtime.

-- 1) Vault extension (Supabase Vault) — required by hash_access_code / get_code_salt
create extension if not exists supabase_vault with schema vault;

-- 2) Store the access-code salt in Vault.
--    IMPORTANT: this exact value must also be set as the CODE_SALT edge-function secret.
--    Replace the placeholder below before running if editing by hand.
select vault.create_secret('__CODE_SALT__', 'code_salt');

-- 3) Realtime — add the tables the app subscribes to.
--    RealtimeManager subscribes to attendees + events changes.
alter publication supabase_realtime add table public.attendees;
alter publication supabase_realtime add table public.events;
