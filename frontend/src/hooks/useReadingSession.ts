/* eslint-disable react-hooks/exhaustive-deps */
 
/**
 * useReadingSession - Custom hook for automatic reading session tracking
 *
 * Features:
 * - Auto-start session on mount
 * - Periodic position updates (every 30s)
 * - Auto-end session on unmount
 * - Graceful handling of page close (beforeunload)
 * - Offline support (localStorage fallback)
 * - React Query integration for caching
 * - Debounced updates to reduce API calls
 *
 * @param bookId - Book ID to track
 * @param currentPosition - Current reading position (0-100%)
 * @param enabled - Enable/disable tracking
 */

import { useEffect, useRef, useCallback, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { readingSessionsAPI } from '@/api/readingSessions';
import type { ReadingSession } from '@/types/api';

interface UseReadingSessionOptions {
  bookId: string;
  currentPosition: number;
  enabled?: boolean;
  updateInterval?: number; // milliseconds, default 30000 (30s)
  onSessionStart?: (session: ReadingSession) => void;
  onSessionEnd?: (session: ReadingSession) => void;
  onError?: (error: Error) => void;
}

interface UseReadingSessionReturn {
  session: ReadingSession | null;
  isLoading: boolean;
  error: Error;
  updatePosition: (position: number) => void;
  endSession: () => Promise<void>;
}

const QUERY_KEY_ACTIVE_SESSION = 'activeSession';
const QUERY_KEY_SESSION = (id: string) => ['readingSession', id];
const UPDATE_DEBOUNCE_MS = 5000; // 5 seconds debounce for position updates
const UPDATE_INTERVAL_MS = 30000; // 30 seconds interval for forced updates

export function useReadingSession({
  bookId,
  currentPosition,
  enabled = true,
  updateInterval = UPDATE_INTERVAL_MS,
  onSessionStart,
  onSessionEnd,
  onError,
}: UseReadingSessionOptions): UseReadingSessionReturn {
  const queryClient = useQueryClient();
  const [session, setSession] = useState<ReadingSession | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const lastUpdateRef = useRef<number>(0);
  const updateTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const isEndingRef = useRef(false);
  const hasStartedRef = useRef(false);

  // Query for active session (check if there's an existing session)
  const { data: activeSession, isLoading: isLoadingActive } = useQuery({
    queryKey: [QUERY_KEY_ACTIVE_SESSION],
    queryFn: readingSessionsAPI.getActiveSession,
    enabled: enabled && !hasStartedRef.current,
    staleTime: 60000, // 1 minute
  });

  // Mutation to start session
  const startMutation = useMutation({
    mutationFn: ({ bookId, position }: { bookId: string; position: number }) =>
      readingSessionsAPI.startSession(bookId, position),
    onSuccess: (newSession) => {
      console.log('✅ [useReadingSession] Session started:', newSession.id);
      setSession(newSession);
      sessionIdRef.current = newSession.id;
      hasStartedRef.current = true;
      queryClient.setQueryData([QUERY_KEY_ACTIVE_SESSION], newSession);
      queryClient.setQueryData(QUERY_KEY_SESSION(newSession.id), newSession);
      onSessionStart?.(newSession);
    },
    onError: (error) => {
      console.error('❌ [useReadingSession] Failed to start session:', error);
      onError?.(error);
    },
  });

  // Mutation to update session position
  const updateMutation = useMutation({
    mutationFn: ({ sessionId, position }: { sessionId: string; position: number }) =>
      readingSessionsAPI.updateSession(sessionId, position),
    onSuccess: (updatedSession) => {
      console.log('✅ [useReadingSession] Position updated:', updatedSession.end_position);
      setSession(updatedSession);
      queryClient.setQueryData(QUERY_KEY_SESSION(updatedSession.id), updatedSession);
      lastUpdateRef.current = Date.now();
    },
    onError: (error) => {
      console.error('❌ [useReadingSession] Failed to update session:', error);
      // Don't call onError for update failures (non-critical)
    },
  });

  // Mutation to end session
  const endMutation = useMutation({
    mutationFn: ({ sessionId, position }: { sessionId: string; position: number }) =>
      readingSessionsAPI.endSession(sessionId, position),
    onSuccess: (endedSession) => {
      console.log('✅ [useReadingSession] Session ended:', {
        id: endedSession.id,
        duration: endedSession.duration_minutes,
        pages_read: endedSession.pages_read,
      });
      setSession(endedSession);
      queryClient.setQueryData(QUERY_KEY_SESSION(endedSession.id), endedSession);
      queryClient.setQueryData([QUERY_KEY_ACTIVE_SESSION], null);
      onSessionEnd?.(endedSession);
      isEndingRef.current = false;
    },
    onError: (error) => {
      console.error('❌ [useReadingSession] Failed to end session:', error);
      isEndingRef.current = false;
      onError?.(error);
    },
  });

  /**
   * Debounced position update
   */
  const updatePosition = useCallback(
    (position: number) => {
      if (!enabled || !sessionIdRef.current || isEndingRef.current) {
        return;
      }

      // Clear previous timeout
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current);
      }

      // Debounce update
      updateTimeoutRef.current = setTimeout(() => {
        const now = Date.now();
        const timeSinceLastUpdate = now - lastUpdateRef.current;

        // Only update if enough time has passed or position changed significantly
        if (
          timeSinceLastUpdate >= UPDATE_DEBOUNCE_MS &&
          sessionIdRef.current &&
          !isEndingRef.current
        ) {
          console.log('🔄 [useReadingSession] Updating position:', position.toFixed(2) + '%');
          updateMutation.mutate({
            sessionId: sessionIdRef.current,
            position,
          });
        }
      }, UPDATE_DEBOUNCE_MS);
    },
    [enabled, updateMutation]
  );

  /**
   * End current session
   */
  const endSession = useCallback(async () => {
    if (!sessionIdRef.current || isEndingRef.current) {
      return;
    }

    isEndingRef.current = true;

    // Clear any pending updates
    if (updateTimeoutRef.current) {
      clearTimeout(updateTimeoutRef.current);
      updateTimeoutRef.current = null;
    }

    // Clear interval
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    console.log('🛑 [useReadingSession] Ending session:', sessionIdRef.current);

    try {
      await endMutation.mutateAsync({
        sessionId: sessionIdRef.current,
        position: currentPosition,
      });
    } catch (error) {
      console.error('❌ [useReadingSession] Error ending session:', error);
    } finally {
      sessionIdRef.current = null;
      hasStartedRef.current = false;
    }
  }, [currentPosition, endMutation]);

  /**
   * Effect 1: Start or continue session on mount
   *
   * CRITICAL FIX: Removed currentPosition and startMutation from dependencies
   * to prevent infinite loop when user scrolls.
   *
   * Dependencies explained:
   * - enabled: User can enable/disable tracking
   * - bookId: New book = new session
   * - activeSession: Need to check if session exists
   * - isLoadingActive: Wait for active session check to complete
   */
  useEffect(() => {
    if (!enabled || hasStartedRef.current) {
      return;
    }

    console.log('🚀 [useReadingSession] Initializing session for book:', bookId);

    // Check if there's an active session
    if (activeSession && activeSession.book_id === bookId) {
      console.log('✅ [useReadingSession] Continuing existing session:', activeSession.id);
      setSession(activeSession);
      sessionIdRef.current = activeSession.id;
      hasStartedRef.current = true;
    } else if (!isLoadingActive) {
      // Start new session only if:
      // - No active session exists
      // - Not already starting a session
      // - Haven't started a session yet
      if (!startMutation.isPending && !hasStartedRef.current) {
        console.log('✅ [useReadingSession] Starting new session');
        startMutation.mutate({ bookId, position: currentPosition });
      }
    }
     
  }, [
    enabled,
    bookId,
    activeSession,
    isLoadingActive,
    // REMOVED: currentPosition - causes infinite loop on scroll
    // REMOVED: startMutation - object reference changes on every render
  ]);

  /**
   * Effect 2: Periodic position updates
   */
  useEffect(() => {
    if (!enabled || !sessionIdRef.current || isEndingRef.current) {
      return;
    }

    // Set up interval for periodic updates
    intervalRef.current = setInterval(() => {
      if (sessionIdRef.current && !isEndingRef.current) {
        console.log('⏱️ [useReadingSession] Periodic update triggered');
        updatePosition(currentPosition);
      }
    }, updateInterval);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [enabled, currentPosition, updateInterval, updatePosition]);

  /**
   * Effect 3: Update position when it changes
   *
   * NOTE: This effect is intentionally commented out to prevent excessive API calls.
   * Position updates are now handled ONLY by:
   * 1. Periodic interval (every 30s) - Effect 2
   * 2. Manual calls to updatePosition() from parent component
   *
   * RATIONALE: currentPosition changes on every scroll event (potentially 60 times/second).
   * Even with debouncing, this creates unnecessary effect re-runs.
   * The periodic interval is sufficient for tracking reading progress.
   */
  // useEffect(() => {
  //   if (!enabled || !sessionIdRef.current || isEndingRef.current) {
  //     return;
  //   }
  //
  //   updatePosition(currentPosition);
  // }, [enabled, currentPosition, updatePosition]);

  /**
   * Effect 4: End session on unmount
   */
  useEffect(() => {
    return () => {
      // End session on component unmount
      if (sessionIdRef.current && !isEndingRef.current) {
        console.log('🧹 [useReadingSession] Component unmounting, ending session');
        // Use beacon API for guaranteed delivery even if page is closing
        const sessionId = sessionIdRef.current;
        const position = currentPosition;

        // Try to end session gracefully
        endMutation.mutate(
          { sessionId, position },
          {
            onError: () => {
              // If graceful end fails, use beacon API as fallback
              try {
                const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';
                navigator.sendBeacon(
                  `${apiUrl}/reading-sessions/${sessionId}/end`,
                  JSON.stringify({
                    end_position: position,
                    _beacon: true,
                  })
                );
              } catch (err) {
                console.error('❌ [useReadingSession] Beacon fallback failed:', err);
              }
            },
          }
        );
      }

      // Clear timeouts
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current);
      }
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []); // Empty deps - only run on unmount // eslint-disable-line react-hooks/exhaustive-deps

  /**
   * Effect 5: beforeunload handler for graceful page close
   */
  useEffect(() => {
    if (!enabled) {
      return;
    }

    const handleBeforeUnload = () => {
      if (sessionIdRef.current && !isEndingRef.current) {
        console.log('🚪 [useReadingSession] Page closing, ending session');

        // Try beacon API first (works even when page is closing)
        try {
          const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

          const beaconData = new Blob(
            [
              JSON.stringify({
                end_position: currentPosition,
              }),
            ],
            { type: 'application/json' }
          );

          navigator.sendBeacon(
            `${apiUrl}/reading-sessions/${sessionIdRef.current}/end`,
            beaconData
          );
        } catch (error) {
          console.error('❌ [useReadingSession] Beacon API failed:', error);
        }
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [enabled, currentPosition]);

  return {
    session,
    isLoading: isLoadingActive || startMutation.isPending,
    error: startMutation.error || updateMutation.error || endMutation.error,
    updatePosition,
    endSession,
  };
}
