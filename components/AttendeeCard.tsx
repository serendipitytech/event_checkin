/**
 * Lintnotes
 * - Purpose: Reusable attendee display component supporting both row (list) and card (grid) modes.
 * - Exports: AttendeeCard (React component), AttendeeCardProps type
 * - Major deps: react-native UI, react-native-gesture-handler Swipeable
 * - Side effects: None (pure presentational component)
 */
import React, { useRef } from 'react';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';

import type { Attendee } from '../services/attendees';
import { useDeviceLayout } from '../hooks/useDeviceLayout';
import {
  CARD_DIMENSIONS,
  SWIPE_THRESHOLD,
  type DeviceType,
} from '../constants/responsive';

export type AttendeeCardMode = 'row' | 'card';
export type AttendeeAction = 'check-in' | 'undo';

export type AttendeeCardProps = {
  attendee: Attendee;
  mode: AttendeeCardMode;
  isViewingCheckedIn: boolean;
  undoProtectionLevel: 'relaxed' | 'standard' | 'strict';
  onAction: (attendee: Attendee, action: AttendeeAction, origin: 'tap' | 'swipe') => void;
  lastTapRef: React.MutableRefObject<{ id: string; timestamp: number } | null>;
};

export const AttendeeCard: React.FC<AttendeeCardProps> = ({
  attendee,
  mode,
  isViewingCheckedIn,
  undoProtectionLevel,
  onAction,
  lastTapRef,
}) => {
  const swipeRef = useRef<Swipeable | null>(null);
  const { deviceType } = useDeviceLayout();

  const isPending = !attendee.checkedIn;
  const groupLabel = attendee.groupName || 'No group';
  const tableLabel = attendee.tableNumber || '—';
  const ticketLabel = attendee.ticketType || '—';

  const handleDoubleTap = (action: AttendeeAction) => {
    const now = Date.now();
    if (
      lastTapRef.current &&
      lastTapRef.current.id === attendee.id &&
      now - lastTapRef.current.timestamp < 400
    ) {
      lastTapRef.current = null;
      onAction(attendee, action, 'tap');
    } else {
      lastTapRef.current = { id: attendee.id, timestamp: now };
    }
  };

  const handleSwipeOpen = (action: AttendeeAction) => {
    onAction(attendee, action, 'swipe');
    swipeRef.current?.close();
  };

  const handleLongPress = () => {
    onAction(attendee, 'undo', 'tap');
  };

  const handleSingleTap = (action: AttendeeAction) => {
    // In card mode on tablet, single tap opens confirmation
    if (mode === 'card') {
      onAction(attendee, action, 'tap');
    } else {
      // In row mode, use double-tap
      handleDoubleTap(action);
    }
  };

  // Render content based on mode
  const renderContent = () => {
    if (mode === 'card') {
      return (
        <View style={[styles.card, !isPending && isViewingCheckedIn && styles.cardCheckedIn]}>
          <Text style={styles.cardName} numberOfLines={1}>
            {attendee.attendeeName}
          </Text>
          <Text style={styles.cardMeta} numberOfLines={1}>
            Table {tableLabel} • {ticketLabel}
          </Text>
          <Text style={styles.cardGroup} numberOfLines={1}>
            {groupLabel}
          </Text>
          <View
            style={[
              styles.statusPill,
              isPending ? styles.statusPending : styles.statusChecked,
            ]}
          >
            <Text style={styles.statusPillLabel}>
              {isPending ? 'Pending' : 'Checked'}
            </Text>
          </View>
          {!isPending && isViewingCheckedIn && undoProtectionLevel === 'standard' && (
            <Text style={styles.holdToUndoHint}>Hold to undo</Text>
          )}
        </View>
      );
    }

    // Row mode (existing design)
    return (
      <View
        style={[
          styles.row,
          !isPending && isViewingCheckedIn && styles.rowCheckedInView,
        ]}
      >
        <View style={styles.rowInfo}>
          <Text style={styles.rowName}>{attendee.attendeeName}</Text>
          <View style={styles.rowMetaContainer}>
            <Text style={styles.rowMeta}>
              {`${groupLabel} • Table ${tableLabel} • ${ticketLabel}`}
            </Text>
            {!isPending && isViewingCheckedIn && undoProtectionLevel === 'standard' && (
              <Text style={styles.holdToUndoHintRow}>Hold to undo</Text>
            )}
          </View>
        </View>
        <View
          style={[
            styles.statusPill,
            isPending ? styles.statusPending : styles.statusChecked,
          ]}
        >
          <Text style={styles.statusPillLabel}>
            {isPending ? 'Pending' : 'Checked'}
          </Text>
        </View>
      </View>
    );
  };

  // For pending attendees: swipe gesture (row mode) or tap (card mode)
  if (isPending) {
    if (mode === 'card') {
      return (
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => handleSingleTap('check-in')}
          accessibilityRole="button"
          accessibilityLabel={`${attendee.attendeeName}. Group ${groupLabel}. Table ${tableLabel}. Ticket ${ticketLabel}. Pending. Tap to check in.`}
          style={styles.cardWrapper}
        >
          {renderContent()}
        </TouchableOpacity>
      );
    }

    // Row mode with swipe
    return (
      <Swipeable
        ref={swipeRef}
        friction={2}
        leftThreshold={SWIPE_THRESHOLD[deviceType]}
        overshootLeft={false}
        renderLeftActions={() => (
          <View style={[styles.swipeAction, { backgroundColor: '#27ae60' }]}>
            <Text style={styles.swipeActionLabel}>Check In</Text>
          </View>
        )}
        onSwipeableLeftOpen={() => handleSwipeOpen('check-in')}
      >
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => handleDoubleTap('check-in')}
          accessibilityRole="button"
          accessibilityLabel={`${attendee.attendeeName}. Group ${groupLabel}. Table ${tableLabel}. Ticket ${ticketLabel}. Pending.`}
        >
          {renderContent()}
        </TouchableOpacity>
      </Swipeable>
    );
  }

  // For checked-in attendees: behavior depends on protection level and mode
  if (undoProtectionLevel === 'relaxed') {
    if (mode === 'card') {
      return (
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => handleSingleTap('undo')}
          accessibilityRole="button"
          accessibilityLabel={`${attendee.attendeeName}. Checked in. Tap to undo.`}
          style={styles.cardWrapper}
        >
          {renderContent()}
        </TouchableOpacity>
      );
    }

    // Row mode with swipe for relaxed
    return (
      <Swipeable
        ref={swipeRef}
        friction={2}
        leftThreshold={SWIPE_THRESHOLD[deviceType]}
        overshootLeft={false}
        renderLeftActions={() => (
          <View style={[styles.swipeAction, { backgroundColor: '#c0392b' }]}>
            <Text style={styles.swipeActionLabel}>Undo</Text>
          </View>
        )}
        onSwipeableLeftOpen={() => handleSwipeOpen('undo')}
      >
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => handleDoubleTap('undo')}
          accessibilityRole="button"
          accessibilityLabel={`${attendee.attendeeName}. Checked in.`}
        >
          {renderContent()}
        </TouchableOpacity>
      </Swipeable>
    );
  }

  // Standard/Strict: hold to undo (no swipe), double-tap fallback
  return (
    <TouchableOpacity
      activeOpacity={0.8}
      delayLongPress={800}
      onLongPress={handleLongPress}
      onPress={() => handleDoubleTap('undo')}
      accessibilityRole="button"
      accessibilityLabel={`${attendee.attendeeName}. Checked in. Hold to undo.`}
      accessibilityHint="Hold for 0.8 seconds to undo check-in"
      style={mode === 'card' ? styles.cardWrapper : undefined}
    >
      {renderContent()}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  // Card mode styles
  cardWrapper: {
    flex: 1,
    margin: CARD_DIMENSIONS.gap.phone / 2,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: CARD_DIMENSIONS.padding.phone,
    minHeight: CARD_DIMENSIONS.minHeight,
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  cardCheckedIn: {
    borderLeftWidth: 4,
    borderLeftColor: '#ff9500',
  },
  cardName: {
    fontSize: 16,
    fontWeight: '600',
    fontFamily: 'System',
    color: '#1f1f1f',
    marginBottom: 4,
  },
  cardMeta: {
    fontSize: 13,
    fontFamily: 'System',
    color: '#6e6e73',
    marginBottom: 2,
  },
  cardGroup: {
    fontSize: 12,
    fontFamily: 'System',
    color: '#8e8e93',
    marginBottom: 8,
  },

  // Row mode styles
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#ffffff',
  },
  rowCheckedInView: {
    borderLeftWidth: 4,
    borderLeftColor: '#ff9500',
    paddingLeft: 12,
  },
  rowInfo: {
    flex: 1,
    paddingRight: 12,
  },
  rowMetaContainer: {
    flexDirection: 'column',
    gap: 2,
  },
  rowName: {
    fontSize: 17,
    fontWeight: '600',
    fontFamily: 'System',
    color: '#1f1f1f',
  },
  rowMeta: {
    marginTop: 2,
    fontSize: 13,
    fontFamily: 'System',
    color: '#8e8e93',
  },
  holdToUndoHintRow: {
    fontSize: 11,
    fontStyle: 'italic',
    color: '#a65f00',
    marginTop: 2,
  },

  // Shared styles
  statusPill: {
    minWidth: 72,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    alignItems: 'center',
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  statusPending: {
    backgroundColor: '#f4f4f6',
  },
  statusChecked: {
    backgroundColor: '#d1f7de',
  },
  statusPillLabel: {
    fontSize: 12,
    fontFamily: 'System',
    fontWeight: '600',
    color: '#1f1f1f',
  },
  holdToUndoHint: {
    fontSize: 11,
    fontStyle: 'italic',
    color: '#a65f00',
    marginTop: 4,
    textAlign: 'center',
  },
  swipeAction: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  swipeActionLabel: {
    fontSize: 15,
    fontFamily: 'System',
    fontWeight: '600',
    color: '#ffffff',
  },
});

export default AttendeeCard;
