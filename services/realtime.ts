/**
 * Lintnotes
 * - Purpose: Manage Supabase Realtime subscriptions with reconnection/backoff logic and connection status tracking.
 * - Exports: RealtimeSubscriptionOptions/RealtimeConnectionStatus (types), realtimeManager (singleton),
 *            subscribeToAttendees, subscribeToEvents, getRealtimeConnectionStatus, getAllRealtimeConnectionStatuses, cleanupRealtimeConnections.
 * - Major deps: @supabase/supabase-js RealtimeChannel, services/supabase
 * - Side effects: Opens/closes realtime channels; schedules timeouts for reconnect attempts; stores state in module singletons.
 */
import { getSupabaseClient } from './supabase';
import type { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js';

export type RealtimeSubscriptionOptions = {
  eventId: string;
  onError?: (error: Error) => void;
  onStatusChange?: (status: 'SUBSCRIBED' | 'CHANNEL_ERROR' | 'TIMED_OUT' | 'CLOSED') => void;
  onReconnected?: () => void;
  reconnectAttempts?: number;
  reconnectDelay?: number;
};

export type RealtimeConnectionStatus = {
  isConnected: boolean;
  lastError?: Error;
  reconnectAttempts: number;
  lastConnectedAt?: Date;
};

class RealtimeManager {
  private channels = new Map<string, RealtimeChannel>();
  private connectionStatus = new Map<string, RealtimeConnectionStatus>();
  private reconnectTimeouts = new Map<string, NodeJS.Timeout>();

  subscribeToAttendees(
    options: RealtimeSubscriptionOptions,
    onChange: (change: RealtimePostgresChangesPayload<any>) => void
  ): () => void {
    const { eventId, onError, onStatusChange, reconnectAttempts = 3, reconnectDelay = 2000 } = options;
    const channelName = `attendees-${eventId}`;
    
    // Clean up existing subscription
    this.unsubscribe(channelName);

    const supabase = getSupabaseClient();
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'attendees',
          filter: `event_id=eq.${eventId}`,
        },
        (payload) => {
          console.log('Real-time attendee change:', payload);
          onChange(payload);
        }
      )
      .subscribe((status) => {
        console.log(`Real-time subscription status for ${channelName}:`, status);
        
        const previousStatus = this.connectionStatus.get(channelName);
        const wasDisconnected = previousStatus && !previousStatus.isConnected;
        
        this.updateConnectionStatus(channelName, status);
        onStatusChange?.(status);

        // Trigger onReconnected callback when connection is restored
        if (status === 'SUBSCRIBED' && wasDisconnected) {
          console.log(`✅ Reconnected to ${channelName}, triggering data refresh`);
          options.onReconnected?.();
        }

        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          this.handleReconnection(channelName, options, onChange);
        }
      });

    this.channels.set(channelName, channel);
    this.connectionStatus.set(channelName, {
      isConnected: false,
      reconnectAttempts: 0,
    });

    return () => this.unsubscribe(channelName);
  }

  subscribeToEvents(
    options: Omit<RealtimeSubscriptionOptions, 'eventId'> & { orgId: string },
    onChange: (change: RealtimePostgresChangesPayload<any>) => void
  ): () => void {
    const { orgId, onError, onStatusChange, reconnectAttempts = 3, reconnectDelay = 2000 } = options;
    const channelName = `events-${orgId}`;
    
    // Clean up existing subscription
    this.unsubscribe(channelName);

    const supabase = getSupabaseClient();
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'events',
          filter: `org_id=eq.${orgId}`,
        },
        (payload) => {
          console.log('Real-time event change:', payload);
          onChange(payload);
        }
      )
      .subscribe((status) => {
        console.log(`Real-time subscription status for ${channelName}:`, status);
        
        this.updateConnectionStatus(channelName, status);
        onStatusChange?.(status);

        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          this.handleReconnection(channelName, { ...options, eventId: orgId }, onChange);
        }
      });

    this.channels.set(channelName, channel);
    this.connectionStatus.set(channelName, {
      isConnected: false,
      reconnectAttempts: 0,
    });

    return () => this.unsubscribe(channelName);
  }

  private updateConnectionStatus(channelName: string, status: string) {
    const current = this.connectionStatus.get(channelName) || {
      isConnected: false,
      reconnectAttempts: 0,
    };

    this.connectionStatus.set(channelName, {
      ...current,
      isConnected: status === 'SUBSCRIBED',
      lastConnectedAt: status === 'SUBSCRIBED' ? new Date() : current.lastConnectedAt,
      lastError: status === 'CHANNEL_ERROR' ? new Error('Channel error') : current.lastError,
    });
  }

  private handleReconnection(
    channelName: string,
    options: RealtimeSubscriptionOptions,
    onChange: (change: RealtimePostgresChangesPayload<any>) => void
  ) {
    const current = this.connectionStatus.get(channelName);
    if (!current) return;

    const { reconnectAttempts: maxAttempts, reconnectDelay } = options;
    const attempts = current.reconnectAttempts + 1;

    if (attempts > maxAttempts) {
      console.error(`Max reconnection attempts (${maxAttempts}) reached for ${channelName}`);
      options.onError?.(new Error(`Failed to reconnect after ${maxAttempts} attempts`));
      return;
    }

    console.log(`Attempting to reconnect ${channelName} (attempt ${attempts}/${maxAttempts})`);

    this.connectionStatus.set(channelName, {
      ...current,
      reconnectAttempts: attempts,
    });

    // Clear existing timeout
    const existingTimeout = this.reconnectTimeouts.get(channelName);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }

    // Schedule reconnection
    const timeout = setTimeout(() => {
      this.reconnectTimeouts.delete(channelName);
      this.subscribeToAttendees(options, onChange);
    }, reconnectDelay * attempts); // Exponential backoff

    this.reconnectTimeouts.set(channelName, timeout);
  }

  private unsubscribe(channelName: string) {
    const channel = this.channels.get(channelName);
    if (channel) {
      const supabase = getSupabaseClient();
      supabase.removeChannel(channel);
      this.channels.delete(channelName);
    }

    const timeout = this.reconnectTimeouts.get(channelName);
    if (timeout) {
      clearTimeout(timeout);
      this.reconnectTimeouts.delete(channelName);
    }

    this.connectionStatus.delete(channelName);
  }

  getConnectionStatus(channelName: string): RealtimeConnectionStatus | undefined {
    return this.connectionStatus.get(channelName);
  }

  getAllConnectionStatuses(): Map<string, RealtimeConnectionStatus> {
    return new Map(this.connectionStatus);
  }

  // Clean up all subscriptions
  cleanup() {
    for (const channelName of this.channels.keys()) {
      this.unsubscribe(channelName);
    }
  }
}

// Singleton instance
export const realtimeManager = new RealtimeManager();

// Convenience functions
export const subscribeToAttendees = (
  options: RealtimeSubscriptionOptions,
  onChange: (change: RealtimePostgresChangesPayload<any>) => void
) => realtimeManager.subscribeToAttendees(options, onChange);

export const subscribeToEvents = (
  options: Omit<RealtimeSubscriptionOptions, 'eventId'> & { orgId: string },
  onChange: (change: RealtimePostgresChangesPayload<any>) => void
) => realtimeManager.subscribeToEvents(options, onChange);

export const getRealtimeConnectionStatus = (channelName: string) => 
  realtimeManager.getConnectionStatus(channelName);

export const getAllRealtimeConnectionStatuses = () => 
  realtimeManager.getAllConnectionStatuses();

export const cleanupRealtimeConnections = () => 
  realtimeManager.cleanup();
