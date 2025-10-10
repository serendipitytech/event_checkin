-- =============================================================
-- Demo Attendee Generator for QA
-- Author: ChatGPT (Amber) ✨
-- =============================================================

-- ⚠️ Toggle: set TRUE if you want to clear existing demo data
DO $$
BEGIN
  IF TRUE THEN  -- change to FALSE if you want to append instead
    DELETE FROM public.attendees
    WHERE event_id IN (
      '5e764751-1839-4df3-8546-c3153666a457',
      'd76a60fb-a423-4853-8e8a-b84406dad5ff'
    );
  END IF;
END $$;

-- =============================================================
-- Common data arrays
-- =============================================================
DO $$
DECLARE
  first_names text[] := ARRAY[
    'Ava','Liam','Olivia','Noah','Emma','Ethan','Sophia','Mason','Isabella','Logan',
    'Mia','Lucas','Amelia','Jackson','Harper','Aiden','Evelyn','Caden','Ella','Grayson',
    'Scarlett','Leo','Aria','Wyatt','Chloe','Ezra','Layla','Henry','Ellie','Sebastian',
    'Nora','Owen','Hazel','Elijah','Luna','Caleb','Zoey','Jack','Lily','James'
  ];
  ticket_types text[] := ARRAY['VIP','General','Student'];
  sponsors text[] := ARRAY['Sponsor A','Sponsor B','Sponsor C','Sponsor D'];
  tables text[] := ARRAY['1','2','3','4','5','6','7','8','9','10'];

  sponsor_counts jsonb := '{}'::jsonb;
  name text;
  sponsor text;
  ticket text;
  tbl text;
  i int;
  total int;
  event1 uuid := '5e764751-1839-4df3-8546-c3153666a457';
  event2 uuid := 'd76a60fb-a423-4853-8e8a-b84406dad5ff';
  evt uuid;
  event_name text;
BEGIN
  -- Helper: get next sponsor with available capacity
  FOR evt, total, event_name IN
    SELECT e.id, t.total, e.name
    FROM (VALUES
      (event1, 40, 'Demo Event 1'),
      (event2, 60, 'Demo Event 2')
    ) AS t(id, total, name)
    JOIN events e ON e.id = t.id
  LOOP
    sponsor_counts := '{}'::jsonb;  -- reset counts per event
    FOR i IN 1..total LOOP
      name := first_names[(random() * (array_length(first_names,1)-1) + 1)::int];
      ticket := ticket_types[(random() * (array_length(ticket_types,1)-1) + 1)::int];
      tbl := tables[(random() * (array_length(tables,1)-1) + 1)::int];

      -- assign sponsor if <14 members
      IF (jsonb_extract_path_text(sponsor_counts, 'Sponsor A')::int < 14 OR sponsor_counts ? 'Sponsor A' = FALSE)
         AND random() < 0.25 THEN sponsor := 'Sponsor A';
      ELSIF (jsonb_extract_path_text(sponsor_counts, 'Sponsor B')::int < 14 OR sponsor_counts ? 'Sponsor B' = FALSE)
         AND random() < 0.25 THEN sponsor := 'Sponsor B';
      ELSIF (jsonb_extract_path_text(sponsor_counts, 'Sponsor C')::int < 14 OR sponsor_counts ? 'Sponsor C' = FALSE)
         AND random() < 0.25 THEN sponsor := 'Sponsor C';
      ELSIF (jsonb_extract_path_text(sponsor_counts, 'Sponsor D')::int < 14 OR sponsor_counts ? 'Sponsor D' = FALSE)
         AND random() < 0.25 THEN sponsor := 'Sponsor D';
      ELSE
         sponsor := 'Open Seating';
      END IF;

      -- increment sponsor count
      sponsor_counts := sponsor_counts || jsonb_build_object(
        sponsor, coalesce((sponsor_counts ->> sponsor)::int, 0) + 1
      );

      INSERT INTO public.attendees (
        event_id, full_name, group_name, table_number, ticket_type, checked_in
      )
      VALUES (
        evt,
        name || ' ' || event_name,
        sponsor,
        tbl,
        ticket,
        false
      );
    END LOOP;
    RAISE NOTICE 'Inserted % attendees for %', total, event_name;
  END LOOP;
END $$;

select event_id, count(*) from attendees group by event_id;