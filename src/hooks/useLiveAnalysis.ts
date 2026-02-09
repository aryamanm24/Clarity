'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { GraphState, Proposition, Relationship, Contradiction, Fallacy } from '@/lib/types';
import { EMPTY_GRAPH_STATE } from '@/lib/types';
import { normalizeBackendResponse } from './useBackendData';

interface LiveUpdate {
  new_propositions?: Proposition[];
  new_relationships?: Relationship[];
  new_contradictions?: Contradiction[];
  new_fallacies?: Fallacy[];
  should_interrupt?: boolean;
  interruption_message?: string;
  thought_text?: string;
}

export function useLiveAnalysis() {
  const [graphState, setGraphState] = useState<GraphState>(EMPTY_GRAPH_STATE);
  const [isConnected, setIsConnected] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [currentTranscript, setCurrentTranscript] = useState('');
  const [shouldInterrupt, setShouldInterrupt] = useState(false);
  const [interruptionMessage, setInterruptionMessage] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const sessionIdRef = useRef<string>(`session_${Date.now()}`);
  const reconnectAttemptsRef = useRef(0);
  const maxReconnectAttempts = 5;
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cleanupTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const getWebSocketUrl = useCallback(() => {
    if (typeof window === 'undefined') return 'ws://localhost:8001';
    const host =
      process.env.NEXT_PUBLIC_WS_HOST ||
      (window.location.hostname || 'localhost');
    const port = process.env.NEXT_PUBLIC_WS_PORT || '8001';
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${protocol}//${host}:${port}`;
  }, []);

  const connect = useCallback(() => {
    // Cancel any pending disconnect from React Strict Mode remount
    if (cleanupTimerRef.current) {
      clearTimeout(cleanupTimerRef.current);
      cleanupTimerRef.current = null;
    }
    const url = getWebSocketUrl();
    console.log('[LiveAnalysis] Connecting to', url, '(attempt', reconnectAttemptsRef.current + 1, ')');
    const ws = new WebSocket(url);

    ws.onopen = () => {
      console.log('[LiveAnalysis] WebSocket connected');
      reconnectAttemptsRef.current = 0;
      setIsConnected(true);

      ws.send(
        JSON.stringify({
          type: 'start_session',
          session_id: sessionIdRef.current,
        })
      );
    };

    ws.onmessage = (event) => {
      const message = JSON.parse(event.data);

      console.log('[LiveAnalysis] Received:', message.type);

      if (message.type === 'transcript_update') {
        setCurrentTranscript(message.data.partial_transcript || '');
      } else if (message.type === 'analysis_update') {
        const update: LiveUpdate = message.data;

        // Normalize data
        const normalized = {
          new_propositions: update.new_propositions || [],
          new_relationships: update.new_relationships || [],
          new_contradictions: update.new_contradictions || [],
          new_fallacies: update.new_fallacies || [],
        };

        setGraphState((prev) => ({
          ...prev,
          propositions: [...prev.propositions, ...normalized.new_propositions],
          relationships: [...prev.relationships, ...normalized.new_relationships],
          contradictions: [...prev.contradictions, ...normalized.new_contradictions],
          fallacies: [...prev.fallacies, ...normalized.new_fallacies],
        }));

        if (update.thought_text) {
          setCurrentTranscript('');
        }

        if (update.should_interrupt && update.interruption_message) {
          setShouldInterrupt(true);
          setInterruptionMessage(update.interruption_message);

          setTimeout(() => {
            setShouldInterrupt(false);
            setInterruptionMessage(null);
          }, 5000);
        }
      } else if (message.type === 'session_started') {
        console.log('[LiveAnalysis] Session started:', message.session_id);
      }
    };

    ws.onerror = (error) => {
      console.error('[LiveAnalysis] WebSocket error:', error);
    };

    ws.onclose = () => {
      console.log('[LiveAnalysis] WebSocket closed');
      setIsConnected(false);
      wsRef.current = null;

      // Reconnect with exponential backoff
      if (reconnectAttemptsRef.current < maxReconnectAttempts) {
        const delay = Math.min(1000 * 2 ** reconnectAttemptsRef.current, 10000);
        reconnectAttemptsRef.current += 1;
        console.log('[LiveAnalysis] Reconnecting in', delay, 'ms...');
        reconnectTimeoutRef.current = setTimeout(() => {
          connect();
        }, delay);
      }
    };

    wsRef.current = ws;
  }, [getWebSocketUrl]);

  const disconnect = useCallback(() => {
    reconnectAttemptsRef.current = maxReconnectAttempts; // Stop reconnection
    if (cleanupTimerRef.current) {
      clearTimeout(cleanupTimerRef.current);
      cleanupTimerRef.current = null;
    }
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    if (wsRef.current) {
      // Only send end_session if connection is open
      if (wsRef.current.readyState === WebSocket.OPEN) {
        try {
          wsRef.current.send(
            JSON.stringify({
              type: 'end_session',
            })
          );
        } catch (error) {
          console.warn('[LiveAnalysis] Error sending end_session:', error);
        }
      }
      
      // Close connection regardless of state
      wsRef.current.close();
      wsRef.current = null;
    }
    setIsConnected(false);
  }, []);

  const sendTranscriptFragment = useCallback((text: string, isFinal: boolean) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      try {
        wsRef.current.send(
          JSON.stringify({
            type: 'transcript_fragment',
            text: text,
            is_final: isFinal,
          })
        );
      } catch (error) {
        console.error('[LiveAnalysis] Error sending transcript:', error);
      }
    } else if (wsRef.current) {
      console.warn('[LiveAnalysis] WebSocket not ready, state:', wsRef.current.readyState);
    }
  }, []);

  const reset = useCallback(() => {
    setGraphState(EMPTY_GRAPH_STATE);
    setCurrentTranscript('');
    setShouldInterrupt(false);
    setInterruptionMessage(null);
    sessionIdRef.current = `session_${Date.now()}`;
  }, []);

  // Auto-connect on mount
  useEffect(() => {
    connect();

    return () => {
      // Delay disconnect so React Strict Mode remount doesn't close the new socket
      cleanupTimerRef.current = setTimeout(disconnect, 100);
    };
  }, [connect, disconnect]);

  return {
    graphState,
    isConnected,
    isAnalyzing,
    currentTranscript,
    shouldInterrupt,
    interruptionMessage,
    sendTranscriptFragment,
    reset,
  };
}
