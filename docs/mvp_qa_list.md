Perfect ✅ — let’s turn this into a manual QA checklist in Markdown format that you can run through locally each time before tagging/releasing. It’s structured by feature area with step-by-step checks.

Here’s the draft:

⸻

📋 Event Check-In – v1 MVP QA Checklist

🔐 Authentication & Onboarding
	•	Logged-out Admin Screen shows:
	•	Welcome message differentiating attendees vs event planners
	•	“Request Info” button opens modal form
	•	Submitting Request Info form saves to interest_requests table
	•	Email validation rejects invalid formats
	•	Success toast shows on valid submission
	•	Magic Link Login:
	•	Clicking “Sign In” sends Supabase magic link email
	•	Following link logs user into the app
	•	Redirect URL resolves to Expo tunnel (dev) or production domain (prod)

⸻

👤 User Roles & Permissions
	•	Checker Role:
	•	Sees Check-In tab and simplified Admin tab
	•	Admin screen only shows Auto Refresh + Sign Out
	•	Cannot see Bulk Actions, Real-Time Status, Event Management, User Management, or Org Settings
	•	Manager Role:
	•	Sees Check-In tab and full Admin tab
	•	Can invite users from Event Settings
	•	Can reset check-ins
	•	Can sync/import rosters
	•	Sees real-time connection status
	•	Admin Role (if separate):
	•	Sees same as Manager for now (future Org features hidden)

⸻

📋 Check-In Workflow
	•	Attendee list loads correctly after login
	•	Auto Refresh setting updates attendee list at selected interval
	•	Manual check-in works → marks attendee as checked in
	•	Reset Check-Ins button clears all attendee check-in statuses

⸻

📊 Admin Tools
	•	Auto Refresh:
	•	Works from top of Admin page
	•	Persists selection during session
	•	Bulk Actions (bottom of Admin page for Managers/Admins only):
	•	Import CSV/XLSX triggers file picker
	•	Sync Google Sheet triggers sync (if configured)
	•	Reset Check-Ins works
	•	Real-Time Status:
	•	Shows “Connected” when at least one client is active
	•	Shows “Disconnected” when none are connected

⸻

👥 User Management
	•	Invite Flow:
	•	Manager can invite a new user by email → user receives magic link
	•	New user login associates them with the correct event
	•	Existing user invite associates them with additional event membership
	•	Duplicate invites handled gracefully (no duplicates created)
	•	Event Switcher:
	•	“Change” button allows switching between events
	•	Correct role displays per event

⸻

🚫 Hidden / Deferred (for v2)

Confirm the following sections are not visible in v1:
	•	Event Management card (Create/Delete Event)
	•	User Management card (Invite/Manage Users – duplicate functions hidden)
	•	Organization Settings card

⸻

🔚 Logout
	•	Sign Out button logs out the current user
	•	After logout, user sees logged-out Admin screen again

⸻

✅ If all checks above pass, tag this release as v1.0.0-mvp

⸻

Do you want me to also make a condensed “day-of-event quick QA” version (just the most critical flows: login, check-in, auto refresh, reset, logout) for when you’re about to go live and don’t have time for the full list?