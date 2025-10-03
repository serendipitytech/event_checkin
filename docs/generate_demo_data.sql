-- Insert a demo organization
insert into organizations (id, name)
values ('00000000-0000-4000-8000-000000000001', 'Demo Organization');

-- Insert a demo event under that organization
insert into events (id, org_id, name)
values (
  '00000000-0000-4000-8000-000000000002',
  '00000000-0000-4000-8000-000000000001',
  'Demo Event'
);

-- Insert 50 demo attendees
insert into attendees (
  id, event_id, full_name, group_name, table_number, ticket_type, notes, checked_in, updated_at
)
select
  gen_random_uuid(),
  '00000000-0000-4000-8000-000000000002',
  'Attendee ' || i,
  'Group ' || (i % 5 + 1),
  (i % 10 + 1)::text,
  case when i % 2 = 0 then 'VIP' else 'General' end,
  'Auto-generated demo attendee #' || i,
  false,
  now()
from generate_series(1, 50) s(i);