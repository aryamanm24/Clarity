'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { toCamelCase } from '@/lib/types';
import type { Proposition, Relationship, Contradiction, Fallacy, Insight } from '@/lib/types';

interface VoiceState {
  isRecording: boolean;
  isAnalyzing: boolean;
  isPlayingResponse: boolean;
  transcript: string;
  interimText: string;
  error: string | null;
}

interface VoiceModeOptions {
  wsUrl: string;
  onGraph: (data: { propositions: Proposition[]; relationships: Relationship[] }) => void;
  onContradictions: (data: Contradiction[]) => void;
  onFallacies: (data: Fallacy[]) => void;
  onInsights: (data: Insight[]) => void;
  onComplete: () => void;
}

export function useVoiceMode(options: VoiceModeOptions) {
  const [state, setState] = useState<VoiceState>({
    isRecording: false,
    isAnalyzing: false,
    isPlayingResponse: false,
    transcript: '',
    interimText: '',
    error: null,
  });

  const wsRef = useRef<WebSocket | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const connect = useCallback(async () => {
    return new Promise<WebSocket>((resolve, reject) => {
      const ws = new WebSocket(optionsRef.current.wsUrl);
      let resolved = false;

      ws.onopen = () => {
        if (resolved) return;
        resolved = true;
        wsRef.current = ws;
        resolve(ws);
      };
      ws.onerror = () => {
        if (!resolved) {
          resolved = true;
          reject(new Error('WebSocket connection failed. Is the backend running on port 8000?'));
        }
      };
      ws.onclose = (event) => {
        if (!resolved) {
          resolved = true;
          reject(
            new Error(
              event.code === 1006
                ? 'Cannot connect to voice server. Start the backend with: cd clarity-engine-py && .venv/bin/uvicorn main:app --port 8000'
                : `WebSocket closed (code ${event.code})`
            )
          );
        }
      };

      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);

        switch (data.type) {
          case 'transcript':
            setState((prev) => ({
              ...prev,
              interimText: data.is_final ? '' : data.text,
              transcript: data.full_transcript || prev.transcript,
            }));
            break;

          case 'analyzing':
            setState((prev) => ({ ...prev, isAnalyzing: true, isRecording: false }));
            break;

          case 'graph':
            if (data.data?.propositions || data.data?.relationships) {
              const ps = (toCamelCase(data.data.propositions ?? []) as Proposition[]) ?? [];
              const rels = (toCamelCase(data.data.relationships ?? []) as Relationship[]) ?? [];
              optionsRef.current.onGraph({ propositions: ps, relationships: rels });
            }
            break;

          case 'contradictions':
            if (data.data) {
              const c = (toCamelCase(data.data) as Contradiction[]) ?? [];
              optionsRef.current.onContradictions(c);
            }
            break;

          case 'fallacies':
            if (data.data) {
              const f = (toCamelCase(data.data) as Fallacy[]) ?? [];
              optionsRef.current.onFallacies(f);
            }
            break;

          case 'insights':
            if (data.data) {
              const i = (toCamelCase(data.data) as Insight[]) ?? [];
              optionsRef.current.onInsights(i);
            }
            break;

          case 'voice_response':
            if (data.audio) {
              setState((prev) => ({ ...prev, isPlayingResponse: true }));
              const audio = new Audio(`data:audio/mp3;base64,${data.audio}`);
              audioRef.current = audio;
              audio.onended = () => {
                setState((prev) => ({ ...prev, isPlayingResponse: false }));
              };
              audio.play().catch((err) => {
                console.error('Audio playback failed:', err);
                setState((prev) => ({ ...prev, isPlayingResponse: false }));
              });
            }
            break;

          case 'voice_response_text':
            if ('speechSynthesis' in window && data.text) {
              const utterance = new SpeechSynthesisUtterance(data.text);
              utterance.rate = 0.95;
              utterance.pitch = 1.0;
              window.speechSynthesis.speak(utterance);
            }
            break;

          case 'complete':
            setState((prev) => ({ ...prev, isAnalyzing: false }));
            optionsRef.current.onComplete();
            break;

          case 'error':
            setState((prev) => ({ ...prev, error: data.message }));
            break;
        }
      };

      ws.onclose = () => {
        wsRef.current = null;
      };
    });
  }, []);

  const startRecording = useCallback(async () => {
    try {
      setState((prev) => ({ ...prev, error: null, transcript: '', interimText: '' }));

      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
        await connect();
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: 16000,
          echoCancellation: true,
          noiseSuppression: true,
        },
      });
      mediaStreamRef.current = stream;

      const audioContext = new AudioContext({ sampleRate: 16000 });
      audioContextRef.current = audioContext;
      const source = audioContext.createMediaStreamSource(stream);
      const processor = audioContext.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;

      processor.onaudioprocess = (e) => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
          const inputData = e.inputBuffer.getChannelData(0);
          const int16 = new Int16Array(inputData.length);
          for (let i = 0; i < inputData.length; i++) {
            int16[i] = Math.max(-32768, Math.min(32767, Math.round(inputData[i] * 32768)));
          }
          const base64 = btoa(String.fromCharCode(...new Uint8Array(int16.buffer)));
          wsRef.current.send(JSON.stringify({ type: 'audio', data: base64 }));
        }
      };

      source.connect(processor);
      processor.connect(audioContext.destination);

      setState((prev) => ({ ...prev, isRecording: true }));
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('[VoiceMode] startRecording failed:', err);

      let userMessage: string;
      if (message === 'Permission denied' || message.includes('permission')) {
        userMessage = 'Microphone access denied. Please allow microphone access.';
      } else if (
        message.includes('WebSocket') ||
        message.includes('connection') ||
        message.includes('Failed to fetch') ||
        message.includes('ERR_CONNECTION')
      ) {
        userMessage =
          'Cannot connect to voice server. Make sure the backend is running (port 8000) and try again.';
      } else if (message.includes('NotFoundError') || message.includes('not found')) {
        userMessage = 'No microphone found. Please connect a microphone and try again.';
      } else {
        userMessage = `Failed to start recording: ${message}`;
      }

      setState((prev) => ({ ...prev, error: userMessage }));
    }
  }, [connect]);

  const stopRecording = useCallback(() => {
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      mediaStreamRef.current = null;
    }

    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'stop' }));
    }

    setState((prev) => ({ ...prev, isRecording: false }));
  }, []);

  const stopPlayback = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setState((prev) => ({ ...prev, isPlayingResponse: false }));
  }, []);

  useEffect(() => {
    return () => {
      if (wsRef.current) wsRef.current.close();
      if (mediaStreamRef.current) mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      if (audioContextRef.current) audioContextRef.current.close();
    };
  }, []);

  return {
    ...state,
    startRecording,
    stopRecording,
    stopPlayback,
  };
}
