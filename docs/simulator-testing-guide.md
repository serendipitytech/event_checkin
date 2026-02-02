# iOS Simulator Testing Guide

_Last updated: Feb 2026_

This guide walks through testing key features in the iOS Simulator. Use this for systematic QA before releases.

---

## Prerequisites

1. **Xcode installed** with iOS Simulator
2. **Node.js and npm** installed
3. **Expo CLI** available (`npx expo`)

---

## Quick Start

```bash
# Start the development server
npx expo start --tunnel

# Press 'i' to open iOS Simulator
# Or scan QR code with Expo Go on physical device
```

---

## Test Scenarios

### 1. Basic Check-In Flow

**Setup:** Sign in with a test account that has Manager role

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Launch app | Attendee list loads |
| 2 | Tap "Pending" tab (if not selected) | Shows pending attendees |
| 3 | Swipe right on any attendee | Green "Check In" action appears |
| 4 | Complete swipe | Confirmation modal opens |
| 5 | Tap "Confirm Check-In" | Attendee moves to Checked-In list |
| 6 | Tap "Checked In" tab | List shows checked-in attendees |

---

### 2. Undo UX - Standard Protection (Default)

**Setup:** Ensure Admin > Undo Protection is set to "Standard"

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Go to "Checked In" tab | Tab indicator is **amber** (not blue) |
| 2 | Observe filter area | Light amber background tint |
| 3 | Observe attendee rows | Amber left border on each row |
| 4 | Look below tabs | "Viewing checked-in guests" banner visible |
| 5 | Try swiping an attendee | Nothing happens (swipe disabled) |
| 6 | Observe row | "Hold to undo" hint text visible |
| 7 | Hold finger on attendee for 0.8s | Undo modal appears |
| 8 | Observe modal title | Red "Return to Pending" |
| 9 | Observe modal content | Only name shown, no group/table/ticket |
| 10 | Observe warning | "You are returning this guest..." text |
| 11 | Observe button | Red "Return to Pending" button |
| 12 | Tap "Return to Pending" | Attendee moves back to Pending |

---

### 3. Undo UX - Relaxed Protection

**Setup:** Go to Admin > Undo Protection, select "Relaxed"

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Go to "Checked In" tab | Tab indicator still amber |
| 2 | Try swiping an attendee | Red "Undo" action appears |
| 3 | Complete swipe | Undo modal opens |
| 4 | Observe row | "Hold to undo" hint NOT visible |

---

### 4. Undo Protection Setting

**Setup:** Sign in as Manager or Admin

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Go to Admin tab | Undo Protection card visible |
| 2 | Observe options | Relaxed, Standard (Recommended), Strict (Coming Soon) |
| 3 | Tap "Relaxed" | Option becomes selected (dark background) |
| 4 | Go back to Check-In tab | Swipe works for undo |
| 5 | Return to Admin, tap "Standard" | Option selected |
| 6 | Kill and restart app | Setting persists (Standard still selected) |

---

### 5. Offline Mode Testing

**Important:** This requires a physical device OR network link conditioner on Mac.

#### On Physical Device (Recommended)

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Open app, verify attendees load | App is online |
| 2 | Enable Airplane Mode (swipe down, tap airplane) | Device offline |
| 3 | Observe top of check-in screen | Orange "Offline" banner appears |
| 4 | Check in an attendee (swipe or hold) | Check-in succeeds locally |
| 5 | Observe banner | Shows "1 pending" or similar |
| 6 | Check in another attendee | Counter increases |
| 7 | Disable Airplane Mode | Device reconnects |
| 8 | Observe banner | Changes to blue "Syncing..." |
| 9 | Wait a few seconds | Banner disappears (sync complete) |

#### On Simulator (Limited)

The iOS Simulator shares the Mac's network, so you can't easily toggle airplane mode. Options:

1. **Network Link Conditioner** (Xcode > Additional Tools):
   - Set to "100% Loss" profile
   - Test offline behavior

2. **Disconnect Mac from WiFi/Ethernet**:
   - Crude but works
   - Remember to reconnect

---

### 6. Real-Time Sync (Two Devices)

**Setup:** Two devices (or Simulator + physical device) signed into same event

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Open app on both devices | Both show same attendee list |
| 2 | On Device A: check in an attendee | Attendee marked checked |
| 3 | Observe Device B | Attendee updates within 2-3 seconds |
| 4 | On Device B: undo that check-in | Attendee returns to pending |
| 5 | Observe Device A | Attendee updates back to pending |

---

### 7. Access Code Flow

**Setup:** Sign in as Manager, have a second device available

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Go to Admin > Manage Access Codes | Dashboard opens |
| 2 | Tap "Create Code" | Creation modal opens |
| 3 | Select role (Checker), expiration (1 day) | Options selected |
| 4 | Tap "Create" | Code displayed (8 characters) |
| 5 | Tap "Show QR Code" | QR code modal opens |
| 6 | On second device: scan QR code | App opens with code pre-filled |
| 7 | Tap "Redeem Code" | Account created, event access granted |
| 8 | Verify role on second device | Shows "Checker" role |

---

### 8. Sign Out Flow

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Go to Admin tab | Scroll to bottom |
| 2 | Tap "Sign Out" | Confirmation alert appears |
| 3 | Tap "Sign Out" in alert | User signed out |
| 4 | Observe screen | Logged-out welcome screen shown |
| 5 | Kill and relaunch app | Still logged out (session cleared) |

---

## Simulator Tips

### Opening Simulator Directly
```bash
# List available simulators
xcrun simctl list devices

# Boot a specific simulator
xcrun simctl boot "iPhone 15 Pro"

# Open Simulator app
open -a Simulator
```

### Simulating Network Conditions
1. Open Xcode
2. Go to Xcode > Open Developer Tool > More Developer Tools
3. Download "Additional Tools for Xcode"
4. Install Network Link Conditioner preference pane
5. Enable various network profiles (3G, Edge, 100% Loss)

### Keyboard Shortcuts (Simulator)
- `Cmd + Shift + H` - Home button
- `Cmd + L` - Lock screen
- `Cmd + K` - Toggle software keyboard
- `Cmd + S` - Take screenshot
- `Cmd + R` - Rotate device

### Clearing App Data
```bash
# Find the app's data directory
xcrun simctl get_app_container booted com.yourcompany.appname data

# Or reset entire simulator
xcrun simctl erase "iPhone 15 Pro"
```

---

## Debugging Tips

### View Logs
The Metro bundler terminal shows `console.log` output. Look for:
- `🔄 Realtime reconnected` - Connection recovery
- `Check-in queued for offline sync` - Offline mode active

### React Native Debugger
1. Shake device (or `Cmd + D` in Simulator)
2. Select "Debug Remote JS"
3. Opens Chrome DevTools

### Inspect Network
1. Use Flipper (if configured) or
2. Add logging to service files

---

## Common Issues

| Issue | Solution |
|-------|----------|
| "Expo Go not found" | Install from App Store or use development build |
| "Network request failed" | Check if dev server is running, verify tunnel URL |
| "Session expired" | Sign out and sign back in |
| Changes not showing | Shake device, tap "Reload" |
| Offline mode not triggering | Use physical device with airplane mode |

---

## iPad Testing (v1.3.1+)

### 9. iPad Grid Layout - Portrait

**Setup:** Use iPad Simulator (iPad 10th gen or iPad Pro)

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Launch app in portrait | Attendee cards in 2-column grid |
| 2 | Observe card layout | Name, table, ticket, group visible per card |
| 3 | Tap a pending attendee | Confirmation modal opens (single tap) |
| 4 | Confirm check-in | Attendee marked as checked |
| 5 | Go to Checked In tab | Cards show amber border |
| 6 | Hold card for 0.8s | Undo modal opens |

---

### 10. iPad Grid Layout - Landscape

**Setup:** Rotate iPad Simulator to landscape (`Cmd + Right Arrow`)

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Observe grid | 4-column layout |
| 2 | Observe navigation | Tab bar on LEFT side (not bottom) |
| 3 | Tap attendee card | Confirmation modal opens |
| 4 | Observe modal | Centered, max-width ~500px (not full width) |
| 5 | Rotate back to portrait | Grid changes to 2 columns, tabs move to bottom |

---

### 11. iPad Feature Flag Toggle

**Setup:** Sign in as Manager or Admin

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Go to Admin tab | iPad Layout toggle visible (future UI) |
| 2 | Note: Currently enabled by default | Grid layout active |
| 3 | Disable iPad Layout (when UI available) | Falls back to single-column list |
| 4 | Re-enable | Grid layout returns |

---

### 12. iPad Modal Sizing

**Setup:** iPad in landscape mode

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Trigger check-in modal | Modal width ≤500px, centered |
| 2 | Open Code Redeem modal | Modal width ≤500px, centered |
| 3 | Open QR Code modal | Modal width ~400px, centered |
| 4 | Modals should not stretch full width | Clean, centered appearance |

---

### iPad Simulator Tips

```bash
# Boot iPad simulator
xcrun simctl boot "iPad (10th generation)"
open -a Simulator

# Or iPad Pro for larger screen
xcrun simctl boot "iPad Pro 12.9-inch (6th generation)"
```

**Rotation shortcuts:**
- `Cmd + Left Arrow` - Rotate left
- `Cmd + Right Arrow` - Rotate right

---

## Pre-Release Checklist

Run through these before any release:

- [ ] All test scenarios above pass
- [ ] No console errors/warnings in Metro
- [ ] App doesn't crash on any flow
- [ ] Settings persist after app restart
- [ ] Offline queue syncs correctly
- [ ] Real-time updates work between devices
- [ ] iPad portrait: 2-column grid works
- [ ] iPad landscape: 4-column grid + side nav works
- [ ] Orientation changes handled smoothly
