# Event Check-In QA Checklist

_Last updated: Feb 2026_

This manual QA checklist covers all features through v1.3. Run through before each release.

---

## Quick Pre-Event Checklist

Use this abbreviated list when time is limited (day-of-event verification):

- [ ] App launches and loads attendee list
- [ ] Can check in an attendee (swipe or double-tap)
- [ ] Can undo a check-in (hold 0.8s on Checked-In tab)
- [ ] Offline indicator appears when airplane mode enabled
- [ ] Check-ins queue offline and sync when back online
- [ ] Auto-refresh updates the list
- [ ] Can sign out

---

## Full QA Checklist

### 1. Authentication & Onboarding

#### Logged-Out State
- [ ] Admin screen shows welcome message
- [ ] "Request Info" button opens modal form
- [ ] Email validation rejects invalid formats
- [ ] Success toast shows on valid submission
- [ ] "Enter Access Code" button opens code redemption modal
- [ ] "Sign In" button initiates magic link flow

#### Magic Link Login
- [ ] Clicking "Sign In" sends Supabase magic link email
- [ ] Following link logs user into the app
- [ ] Session persists after app restart

#### Access Code Login (v1.2)
- [ ] Manual code entry works
- [ ] QR code deep link opens app and pre-fills code
- [ ] Valid code grants appropriate role
- [ ] Expired/revoked codes show error message

---

### 2. User Roles & Permissions

#### Checker Role
- [ ] Sees Check-In tab and simplified Admin tab
- [ ] Admin screen shows: Auto Refresh, Event Settings, Sign Out
- [ ] Cannot see: Bulk Actions, Real-Time Status, Undo Protection setting
- [ ] Can check in attendees
- [ ] Can undo check-ins (subject to protection level)

#### Manager Role
- [ ] Sees Check-In tab and full Admin tab
- [ ] Can see Undo Protection setting
- [ ] Can invite users from Event Settings
- [ ] Can reset all check-ins
- [ ] Can manage access codes
- [ ] Sees real-time connection status

#### Admin Role
- [ ] Same as Manager plus Bulk Actions
- [ ] Can import CSV/XLSX
- [ ] Can sync Google Sheets

---

### 3. Check-In Workflow

#### Pending Tab (Default)
- [ ] Attendee list loads correctly after login
- [ ] Search filters attendees by name/group/table/ticket
- [ ] Sort options work (Attendee, Group, Table, Ticket)
- [ ] Swipe right reveals green "Check In" action
- [ ] Completing swipe opens confirmation modal
- [ ] Double-tap opens confirmation modal
- [ ] "Confirm Check-In" button checks in attendee
- [ ] "Check In Group" button available for group actions
- [ ] Attendee moves to Checked-In list after confirmation

#### Checked-In Tab
- [ ] Tab indicator is **amber** (not blue)
- [ ] Filter section has light amber background tint
- [ ] "Viewing checked-in guests" banner appears below tabs
- [ ] Rows have amber left border
- [ ] "Hold to undo" hint text visible (Standard protection)

#### Undo Check-In (Standard Protection - Default)
- [ ] Swipe gesture does **NOT** work on Checked-In tab
- [ ] Hold for 0.8 seconds triggers undo modal
- [ ] Double-tap still works as fallback
- [ ] Undo modal shows:
  - [ ] Red title "Return to Pending"
  - [ ] Attendee name only (no group/table/ticket details)
  - [ ] Warning: "You are returning this guest to the non-checked-in list."
  - [ ] Red "Return to Pending" button
  - [ ] No "Check In Group" option
- [ ] Confirming undo moves attendee back to Pending list

#### Undo Check-In (Relaxed Protection)
- [ ] Change setting in Admin > Undo Protection > Relaxed
- [ ] Swipe gesture works on Checked-In tab (red "Undo" action)
- [ ] Double-tap works
- [ ] "Hold to undo" hint NOT visible
- [ ] Same undo modal appears

---

### 4. Offline Mode (v1.3)

#### Offline Detection
- [ ] Enable airplane mode on device
- [ ] Orange "Offline" banner appears at top of check-in screen
- [ ] Banner shows "You're offline. Check-ins will sync when connected."

#### Offline Check-Ins
- [ ] Can still check in attendees while offline
- [ ] Local UI updates immediately (optimistic update)
- [ ] Pending sync count shown in banner

#### Sync on Reconnect
- [ ] Disable airplane mode
- [ ] Banner changes to blue "Syncing X check-ins..."
- [ ] Check-ins sync automatically
- [ ] Banner disappears when sync complete
- [ ] Manual "Sync" button works if needed

#### Edge Cases
- [ ] App killed while offline, restarted online - queued items sync
- [ ] Multiple offline check-ins for same attendee - only last state syncs
- [ ] Failed syncs show retry option

---

### 5. Admin Tools

#### Auto Refresh
- [ ] Setting appears at top of Admin screen
- [ ] Options: Off, 1s, 5s, 10s, 15s, 30s
- [ ] Selected interval persists during session
- [ ] Attendee list refreshes at selected interval

#### Undo Protection (Manager/Admin only)
- [ ] Setting appears below Auto Refresh
- [ ] Options: Relaxed, Standard (Recommended), Strict (Coming Soon)
- [ ] "Recommended" badge on Standard option
- [ ] "Coming Soon" badge on Strict option (disabled)
- [ ] Selection persists across app restarts
- [ ] Changing setting immediately affects check-in screen behavior

#### Event Settings
- [ ] Current event name displayed
- [ ] "Change" button opens event selector
- [ ] Current role displayed
- [ ] "Invite User" button works (Manager/Admin)
- [ ] "Manage Access Codes" button works (Manager/Admin)

#### Access Code Management (v1.2)
- [ ] Dashboard shows active and inactive codes
- [ ] Can create new code with role/expiration/usage limit
- [ ] QR code modal shows shareable QR
- [ ] Can copy code or copy deep link
- [ ] Can revoke existing codes
- [ ] Usage count updates as codes are redeemed

#### Bulk Actions (Admin only)
- [ ] "Import CSV/XLSX" triggers file picker
- [ ] "Sync Google Sheet" triggers sync
- [ ] "Reset Check-Ins" resets all attendees to pending

#### Real-Time Status (Manager/Admin)
- [ ] Shows "Connected" with green indicator when connected
- [ ] Shows "Disconnected" with red indicator when not
- [ ] Active connection count displayed
- [ ] Reconnect attempts shown when applicable

---

### 6. Event Management

#### Event Switcher
- [ ] "Change" button opens event selector modal
- [ ] All assigned events listed
- [ ] Selecting event switches context
- [ ] Correct role displays per event

#### Multi-Event Access
- [ ] Users with multiple events can switch between them
- [ ] Check-in data is event-specific
- [ ] Settings persist per-device (not per-event)

---

### 7. Account & Privacy

#### Sign Out
- [ ] Sign Out button shows confirmation
- [ ] Confirming logs out user
- [ ] Returns to logged-out state
- [ ] Session cleared (doesn't auto-login on restart)

#### Delete Account
- [ ] "Delete My Account" button shows warning
- [ ] Confirming deletes account
- [ ] User logged out after deletion

---

### 8. Real-Time Sync

- [ ] Check-in on Device A appears on Device B within seconds
- [ ] Undo on Device A reflects on Device B
- [ ] Connection recovers after brief network interruption

---

### 9. UI/UX Verification

#### Visual Consistency
- [ ] Gold/amber header on check-in screen
- [ ] Consistent font styling throughout
- [ ] Status pills: gray for Pending, green for Checked
- [ ] Appropriate spacing and alignment

#### Accessibility
- [ ] VoiceOver reads attendee information correctly
- [ ] All buttons have accessibility labels
- [ ] "Hold to undo" has accessibility hint

#### Performance
- [ ] List scrolls smoothly with 500+ attendees
- [ ] No visible lag on check-in actions
- [ ] App doesn't freeze during sync

---

## Test Environment Setup

### iOS Simulator
```bash
# Start dev server
npx expo start --tunnel

# Press 'i' to open iOS Simulator
```

### Physical Device
1. Install Expo Go from App Store
2. Scan QR code from terminal
3. Or use TestFlight build for production-like testing

### Testing Offline Mode
1. Start app and verify online
2. Enable airplane mode (Settings > Airplane Mode)
3. Perform check-ins
4. Disable airplane mode
5. Watch sync complete

---

## Version History

| Version | Features Added |
|---------|----------------|
| v1.0 | Core check-in, auth, roles |
| v1.1 | Bug fixes, session persistence |
| v1.2 | Access codes, QR sharing |
| v1.3 | Offline mode, Undo UX improvements |
