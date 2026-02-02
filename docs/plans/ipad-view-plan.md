# Implementation Plan: iPad Responsive View

## Requirements Restatement

Build a responsive iPad view for the event check-in app that:
1. Uses a **multi-column grid layout** (2-col portrait, 4-col landscape)
2. Supports **both swipe and tap gestures** for check-in actions
3. Implements **side navigation for landscape mode** (bottom tabs for portrait)
4. Maintains full compatibility with existing phone experience

**Target:** Nice-to-have for 2/20/2026 event
**Branch:** `feature/ipad-view`

---

## Implementation Phases

### Phase 1: Responsive Infrastructure (Foundation)

**Create core responsive utilities:**

1. **`hooks/useDeviceLayout.ts`** - Device detection and breakpoints
   ```typescript
   type DeviceType = 'phone' | 'tablet'
   type Orientation = 'portrait' | 'landscape'
   type Layout = 'phone' | 'tablet-portrait' | 'tablet-landscape'

   // Breakpoints:
   // - Phone: width < 768
   // - Tablet Portrait: width >= 768, height > width
   // - Tablet Landscape: width >= 768, width > height
   ```

2. **`hooks/useResponsiveValue.ts`** - Responsive value selector
   ```typescript
   // Usage: useResponsiveValue({ phone: 1, tabletPortrait: 2, tabletLandscape: 4 })
   ```

3. **`constants/responsive.ts`** - Shared breakpoints and scaling factors
   ```typescript
   export const BREAKPOINTS = { tablet: 768 }
   export const GRID_COLUMNS = { phone: 1, tabletPortrait: 2, tabletLandscape: 4 }
   export const SPACING_SCALE = { phone: 1, tablet: 1.25 }
   ```

**Files to create:**
- `hooks/useDeviceLayout.ts`
- `hooks/useResponsiveValue.ts`
- `constants/responsive.ts`

**Estimated complexity:** Low

---

### Phase 2: Attendee Grid Layout

**Transform FlatList from single column to responsive grid:**

1. **Update `app/(tabs)/index.tsx`:**
   - Import `useDeviceLayout` hook
   - Add `numColumns` prop to FlatList based on layout
   - Handle `key` prop change when columns change (React Native requirement)

2. **Create `components/AttendeeCard.tsx`:**
   - Extract attendee row rendering from index.tsx
   - Support card mode (grid) vs row mode (list)
   - Adapt padding/sizing based on layout
   - Maintain swipe gesture support in row mode
   - Add tap-to-action support in card mode

3. **Card Layout (Grid Mode):**
   ```
   ┌─────────────────────┐
   │ John Smith          │
   │ Table 5 • VIP       │
   │ Group: Smith Family │
   │ ┌─────────────────┐ │
   │ │    [Pending]    │ │
   │ └─────────────────┘ │
   └─────────────────────┘
   ```

4. **Handle orientation changes:**
   - Re-render grid when orientation changes
   - Animate column count transition (optional polish)

**Files to modify:**
- `app/(tabs)/index.tsx`

**Files to create:**
- `components/AttendeeCard.tsx`

**Estimated complexity:** Medium

---

### Phase 3: Gesture System Enhancement

**Support both swipe and tap gestures:**

1. **Swipe Gestures (existing, enhanced):**
   - Increase swipe threshold on tablet (72px → 100px)
   - Add visual swipe hint indicator
   - Works in single-column/row mode

2. **Tap Gestures (new for iPad):**
   - Single tap on card → opens confirmation modal
   - Works in grid mode (where swipe is awkward)
   - Double-tap still available as power-user shortcut

3. **Update gesture logic in AttendeeCard:**
   ```typescript
   // Grid mode (tablet): tap to open modal
   // Row mode (phone or tablet single-col): swipe to check in
   const gestureMode = layout === 'phone' ? 'swipe' : 'tap'
   ```

4. **Hold-to-undo preserved:**
   - Works same in both modes
   - Visual feedback enhanced for larger touch targets

**Files to modify:**
- `app/(tabs)/index.tsx` (move gesture logic to component)
- `components/AttendeeCard.tsx`

**Estimated complexity:** Medium

---

### Phase 4: Adaptive Navigation

**Implement side navigation for landscape iPad:**

1. **Create `components/AdaptiveNavigation.tsx`:**
   - Wrapper that switches between bottom tabs and side nav
   - Uses `useDeviceLayout` to determine mode

2. **Side Navigation Design (Landscape Tablet):**
   ```
   ┌──────┬─────────────────────────────────┐
   │      │                                 │
   │  📋  │     [Main Content Area]         │
   │Check │                                 │
   │      │                                 │
   │──────│                                 │
   │      │                                 │
   │  ⚙️  │                                 │
   │Admin │                                 │
   │      │                                 │
   └──────┴─────────────────────────────────┘
   ```

3. **Update `app/(tabs)/_layout.tsx`:**
   - Conditionally render side nav vs bottom tabs
   - Handle safe areas differently for each mode

4. **Animation/Transition:**
   - Smooth transition when rotating device
   - Preserve scroll position and state

**Files to modify:**
- `app/(tabs)/_layout.tsx`

**Files to create:**
- `components/AdaptiveNavigation.tsx`

**Estimated complexity:** Medium-High

---

### Phase 5: Modal Optimization

**Constrain modals for larger screens:**

1. **Update all modal components:**
   - Max width: 500px on tablet
   - Center on screen with backdrop
   - Slightly larger padding and font sizes

2. **Modals to update:**
   - Check-in confirmation modal (inline in index.tsx)
   - Undo confirmation modal (inline in index.tsx)
   - Group action modal (inline in index.tsx)
   - `RequestInfoModal.tsx`
   - `CodeRedeemModal.tsx`
   - `CreateAccessCodeModal.tsx`
   - `QRCodeModal.tsx`
   - `CreateEventModal.tsx`
   - `InviteUserModal.tsx`
   - `RosterImportModal.tsx`
   - `EventSelectorModal.tsx`

3. **Create shared modal width utility:**
   ```typescript
   // hooks/useModalWidth.ts
   export function useModalWidth() {
     const { width } = useWindowDimensions()
     return Math.min(width - 48, 500) // Max 500px on tablet
   }
   ```

**Files to modify:**
- `app/(tabs)/index.tsx` (inline modals)
- All modal components listed above

**Files to create:**
- `hooks/useModalWidth.ts`

**Estimated complexity:** Low (repetitive but straightforward)

---

### Phase 6: Visual Polish & Testing

**Final adjustments and QA:**

1. **Touch target sizing:**
   - Ensure all buttons meet 44pt minimum
   - Scale to 48-52pt on tablet

2. **Typography scaling:**
   - Header: 18px → 20px on tablet
   - Body: 16px → 17px on tablet
   - Apply via responsive utility

3. **Spacing adjustments:**
   - Apply 1.25x spacing multiplier on tablet
   - Consistent padding increase

4. **Testing matrix:**
   | Device | Orientation | Test Cases |
   |--------|-------------|------------|
   | iPhone 15 | Portrait | Baseline (unchanged) |
   | iPad 10th gen | Portrait | 2-col grid, bottom tabs |
   | iPad 10th gen | Landscape | 4-col grid, side nav |
   | iPad Pro 12.9" | Both | Verify scaling |

5. **Simulator testing guide update:**
   - Add iPad-specific test scenarios
   - Document orientation testing steps

**Files to modify:**
- `docs/simulator-testing-guide.md`
- Various style adjustments across components

**Estimated complexity:** Low-Medium

---

## Dependencies Between Phases

```
Phase 1 (Infrastructure)
    │
    ├──► Phase 2 (Grid Layout)
    │        │
    │        └──► Phase 3 (Gestures)
    │
    ├──► Phase 4 (Navigation)
    │
    └──► Phase 5 (Modals)
              │
              └──► Phase 6 (Polish)
```

- **Phase 1** must complete first (all other phases depend on it)
- **Phases 2-5** can be worked in parallel after Phase 1
- **Phase 6** should be last (polish after features work)

---

## Risk Assessment

| Risk | Severity | Mitigation |
|------|----------|------------|
| FlatList `numColumns` re-render issues | Medium | Use `key` prop tied to column count |
| Gesture conflicts (swipe vs scroll) | Medium | Test extensively, adjust thresholds |
| Orientation change state loss | Low | Use refs for scroll position, persist state |
| Side nav layout complexity | Medium | Start with simple icon-only side nav |
| Testing coverage gaps | Low | Create comprehensive test matrix |

---

## Estimated Complexity by Phase

| Phase | Complexity | New Files | Modified Files |
|-------|------------|-----------|----------------|
| 1. Infrastructure | Low | 3 | 0 |
| 2. Grid Layout | Medium | 1 | 1 |
| 3. Gestures | Medium | 0 | 2 |
| 4. Navigation | Medium-High | 1 | 1 |
| 5. Modals | Low | 1 | 10+ |
| 6. Polish | Low-Medium | 0 | Several |

**Overall Complexity:** Medium

---

## Success Criteria

- [ ] App detects iPad and applies appropriate layout
- [ ] 2-column grid in portrait, 4-column in landscape
- [ ] Both tap and swipe gestures work for check-in
- [ ] Side navigation appears in landscape mode
- [ ] Modals are appropriately sized (not too wide)
- [ ] All existing phone functionality preserved
- [ ] Orientation changes handled smoothly
- [ ] Touch targets meet accessibility guidelines (44pt+)

---

## Rollback Plan

If iPad features cause issues before the 2/20 event:
1. Feature flag: `enableiPadLayout` in settings service
2. Can be toggled off to fall back to phone-style layout
3. All iPad-specific code wrapped in layout conditionals

---

**WAITING FOR CONFIRMATION**: Proceed with this plan? (yes/no/modify)
