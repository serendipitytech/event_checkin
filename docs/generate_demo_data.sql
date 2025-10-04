-- Fix infinite recursion in organization_members RLS policy
-- The issue: org_members_select_self policy references my_orgs view,
-- but my_orgs view references organization_members table, creating circular dependency

-- Drop the problematic policy
DROP POLICY IF EXISTS "org_members_select_self" ON public.organization_members;

-- Recreate the policy without the circular reference
-- Users can see their own memberships directly, no need to reference my_orgs
CREATE POLICY "org_members_select_self"
  ON public.organization_members FOR SELECT
  USING (user_id = auth.uid());

-- Also fix the org_members_manage_by_admins policy to avoid the same issue
DROP POLICY IF EXISTS "org_members_manage_by_admins" ON public.organization_members;

-- Recreate with direct check instead of referencing my_orgs
CREATE POLICY "org_members_manage_by_admins"
  ON public.organization_members FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members m
      WHERE m.org_id = organization_members.org_id
        AND m.user_id = auth.uid()
        AND m.role IN ('owner','admin')
    )
  )
  WITH CHECK (true);

DO $$
DECLARE
  v_user_id uuid;
  v_org_id uuid;
  v_event_id uuid;
BEGIN
  -- 1. Get user ID from Supabase auth.users
  SELECT id INTO v_user_id 
  FROM auth.users 
  WHERE email = 'troy.shimkus@gmail.com';

  -- 2. Create organization
  v_org_id := gen_random_uuid();
  INSERT INTO organizations (id, name) 
  VALUES (v_org_id, 'Demo Organization');

  -- 3. Create event
  v_event_id := gen_random_uuid();
  INSERT INTO events (id, org_id, name)
  VALUES (v_event_id, v_org_id, 'Demo Event');

  -- 4. Link user to event as manager
  INSERT INTO event_members (event_id, user_id, role)
  VALUES (v_event_id, v_user_id, 'manager');

  -- 5. Seed 20 attendees
  FOR i IN 1..20 LOOP
    INSERT INTO attendees (id, event_id, full_name, checked_in)
    VALUES (gen_random_uuid(), v_event_id, 'Attendee ' || i, false);
  END LOOP;

END $$;


More variety Demo data
DO $$
DECLARE
  v_user_id uuid;
  v_org_id uuid;
  v_event_id uuid;
  v_group text;
  v_ticket text;
  v_table int;
BEGIN
  -- 1. Get user ID from Supabase auth.users
  SELECT id INTO v_user_id 
  FROM auth.users 
  WHERE email = 'troy.shimkus@gmail.com';

  -- 2. Reuse the same organization
  SELECT id INTO v_org_id 
  FROM organizations 
  ORDER BY created_at ASC 
  LIMIT 1;

  -- 3. Create a second event
  v_event_id := gen_random_uuid();
  INSERT INTO events (id, org_id, name)
  VALUES (v_event_id, v_org_id, 'Demo Event 2');

  -- 4. Link user to new event as manager
  INSERT INTO event_members (event_id, user_id, role)
  VALUES (v_event_id, v_user_id, 'manager');

  -- 5. Seed 50 attendees with randomized fields
  FOR i IN 1..50 LOOP
    -- Assign group (5 groups)
    v_group := CASE (i % 5)
      WHEN 0 THEN 'Group A'
      WHEN 1 THEN 'Group B'
      WHEN 2 THEN 'Group C'
      WHEN 3 THEN 'Group D'
      ELSE 'Group E'
    END;

    -- Assign ticket type (3 options)
    v_ticket := CASE (i % 3)
      WHEN 0 THEN 'General'
      WHEN 1 THEN 'VIP'
      ELSE 'Student'
    END;

    -- Assign table number randomly between 1–10
    v_table := (floor(random() * 10) + 1)::int;

    INSERT INTO attendees (id, event_id, full_name, group_name, table_number, ticket_type, checked_in)
    VALUES (
      gen_random_uuid(),
      v_event_id,
      'Event2 Attendee ' || i,
      v_group,
      v_table,
      v_ticket,
      false
    );
  END LOOP;

END $$;

-- Replace these UUIDs with your actual event and user IDs
-- You can fetch event IDs with: SELECT id, name FROM events;
-- And user IDs with: SELECT id, email FROM auth.users;

-- Example: Add an existing user as manager of Event 1
INSERT INTO event_members (event_id, user_id, role)
VALUES (
  'EVENT_UUID_1', -- e.g. 'a8178499-e39e-4858-9ef3-369026d5d647'
  'USER_UUID_1',  -- e.g. 'fc39194d-0e1d-4270-8b8e-cb27715115b9'
  'manager'
);

-- Example: Add checker to Event 1
INSERT INTO event_members (event_id, user_id, role)
VALUES (
  'EVENT_UUID_1',
  'USER_UUID_2',
  'checker'
);

-- Example: Add checker to Event 2
INSERT INTO event_members (event_id, user_id, role)
VALUES (
  'EVENT_UUID_2',
  'USER_UUID_3',
  'checker'
);

-- Verify assignments
SELECT em.event_id, e.name as event_name, em.user_id, u.email, em.role
FROM event_members em
JOIN events e ON e.id = em.event_id
JOIN auth.users u ON u.id = em.user_id
ORDER BY e.name, em.role;

-- =========================================
-- Test Script: Verify Event Memberships
-- =========================================

-- 1. Show all events and their members with roles
SELECT 
  e.id AS event_id,
  e.name AS event_name,
  u.email AS user_email,
  em.role,
  em.created_at
FROM event_members em
JOIN events e ON em.event_id = e.id
JOIN auth.users u ON em.user_id = u.id
ORDER BY e.name, em.role, u.email;

-- 2. Verify specific user membership (replace with test email)
SELECT 
  u.email,
  e.name AS event_name,
  em.role,
  em.created_at
FROM event_members em
JOIN events e ON em.event_id = e.id
JOIN auth.users u ON em.user_id = u.id
WHERE u.email = 'troy.shimkus+invite3@gmail.com';

-- 3. Count members per event
SELECT 
  e.name AS event_name,
  COUNT(*) AS total_members,
  COUNT(*) FILTER (WHERE em.role = 'manager') AS managers,
  COUNT(*) FILTER (WHERE em.role = 'checker') AS checkers
FROM event_members em
JOIN events e ON em.event_id = e.id
GROUP BY e.name
ORDER BY e.name;

-- 4. Quick check: list all users who are not yet assigned to any event
SELECT 
  u.email
FROM auth.users u
LEFT JOIN event_members em ON u.id = em.user_id
WHERE em.user_id IS NULL
ORDER BY u.email;

-- =========================================
-- Cleanup Script: Remove Test Users & Memberships
-- =========================================
-- ⚠️ WARNING: This will permanently delete test data.
-- Replace the email(s) or UUID(s) in the IN clauses before running.
-- =========================================

-- Delete from event_members first
DELETE FROM event_members
WHERE user_id IN (
  SELECT id FROM auth.users
  WHERE email IN (
    'troy.shimkus+invite1@gmail.com',
    'troy.shimkus+invite2@gmail.com',
    'troy.shimkus+invite3@gmail.com'
  )
);

-- Then delete from auth.users
DELETE FROM auth.users
WHERE email IN (
  'troy.shimkus+invite1@gmail.com',
  'troy.shimkus+invite2@gmail.com',
  'troy.shimkus+invite3@gmail.com'
);

-- Verify cleanup
SELECT * FROM auth.users WHERE email LIKE '%invite%';
SELECT * FROM event_members WHERE user_id NOT IN (SELECT id FROM auth.users);

-- 4. (Optional) Verify cleanup
SELECT * FROM auth.users WHERE email LIKE '%invite%';
SELECT * FROM event_members WHERE user_id IN (SELECT id FROM target_users);