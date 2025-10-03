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

  -- 3. Create first event
  v_event_id := gen_random_uuid();
  INSERT INTO events (id, org_id, name)
  VALUES (v_event_id, v_org_id, 'Demo Event');

  -- 4. Link user to first event as manager
  INSERT INTO event_members (event_id, user_id, role)
  VALUES (v_event_id, v_user_id, 'manager');

  -- 5. Seed 20 attendees for first event
  FOR i IN 1..20 LOOP
    INSERT INTO attendees (id, event_id, full_name, checked_in)
    VALUES (gen_random_uuid(), v_event_id, 'Attendee ' || i, false);
  END LOOP;

  -- 6. Create second event
  DECLARE
    v_event_id_2 uuid := gen_random_uuid();
  BEGIN
    INSERT INTO events (id, org_id, name)
    VALUES (v_event_id_2, v_org_id, 'Demo Event 2');

    -- 7. Link user to second event as manager
    INSERT INTO event_members (event_id, user_id, role)
    VALUES (v_event_id_2, v_user_id, 'manager');

    -- 8. Seed 15 attendees for second event
    FOR i IN 1..15 LOOP
      INSERT INTO attendees (id, event_id, full_name, checked_in)
      VALUES (gen_random_uuid(), v_event_id_2, 'Event 2 Attendee ' || i, false);
    END LOOP;
  END;

END $$;