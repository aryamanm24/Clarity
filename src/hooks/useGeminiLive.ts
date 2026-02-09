'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { toCamelCase } from '@/lib/types';
import type { Proposition, Relationship, Contradiction, Fallacy, Insight } from '@/lib/types';

interface GeminiLiveState {
  isConnected: boolean;
  isRecording: boolean;
  isGeminiSpeaking: boolean;
  isAnalyzing: boolean;
  userTranscript: string;
  geminiTranscript: string;
  error: string | null;
}

interface GeminiLiveOptions {
  wsUrl: string;
  onGraph: (data: {
    propositions: Proposition[];
    relationships: Relationship[];
    round?: number;
    degraded?: boolean;
  }) => void;
  onContradictions: (data: Contradiction[]) => void;
  onFallacies: (data: Fallacy[]) => void;
  onInsights: (data: Insight[]) => void;
  onAnalysisComplete: () => void;
  onPlaybackStopped?: () => void;
}

export function useGeminiLive(options: GeminiLiveOptions) {
  const [state, setState] = useState<GeminiLiveState>({
    isConnected: false,
    isRecording: false,
    isGeminiSpeaking: false,
    isAnalyzing: false,
    userTranscript: '',
    geminiTranscript: '',
    error: null,
  });

  const wsRef = useRef<WebSocket | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const playbackContextRef = useRef<AudioContext | null>(null);
  const workletNodeRef = useRef<AudioWorkletNode | null>(null);
  const audioInitializedRef = useRef(false);
  const optionsRef = useRef(options);
  optionsRef.current = options;

  // ── Audio Playback (AudioWorklet with jitter buffer) ──

  const initAudioPlayback = useCallback(async () => {
    if (audioInitializedRef.current) {
      console.log('🔊 Audio already initialized');
      return;
    }

    try {
      const ctx = new AudioContext({ sampleRate: 24000 });
      if (ctx.state === 'suspended') {
        await ctx.resume();
      }

      console.log('🔊 Loading AudioWorklet module...');
      await ctx.audioWorklet.addModule('/pcm-playback-processor.js');
      console.log('🔊 AudioWorklet module loaded successfully');

      const workletNode = new AudioWorkletNode(ctx, 'pcm-playback-processor');
      workletNode.connect(ctx.destination);

      workletNode.port.onmessage = (e) => {
        if (e.data.type === 'playback_started') {
          console.log('🔊 AudioWorklet: playback started');
          setState((prev) => ({ ...prev, isGeminiSpeaking: true }));
        } else if (e.data.type === 'playback_stopped') {
          console.log('🔊 AudioWorklet: playback stopped (buffer drained)');
          setState((prev) => ({ ...prev, isGeminiSpeaking: false }));
          optionsRef.current.onPlaybackStopped?.();
        }
      };

      playbackContextRef.current = ctx;
      workletNodeRef.current = workletNode;
      audioInitializedRef.current = true;
      console.log('🔊 Audio playback FULLY initialized (AudioWorklet + jitter buffer)');
    } catch (err) {
      console.error('❌ AudioWorklet init FAILED:', err);
      console.error('❌ Check that /public/pcm-playback-processor.js exists');
    }
  }, []);

  const queueAudioChunk = useCallback((base64Data: string) => {
    if (!base64Data) {
      console.warn('⚠️ queueAudioChunk called with empty data');
      return;
    }
    if (!workletNodeRef.current) {
      console.error('❌ queueAudioChunk: workletNode is NULL — AudioWorklet not initialized!');
      return;
    }

    const binaryStr = atob(base64Data);
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) {
      bytes[i] = binaryStr.charCodeAt(i);
    }

    workletNodeRef.current.port.postMessage({ type: 'audio', buffer: bytes.buffer }, [bytes.buffer]);
  }, []);

  const stopPlayback = useCallback(() => {
    if (workletNodeRef.current) {
      workletNodeRef.current.port.postMessage({ type: 'clear' });
    }
    setState((prev) => ({ ...prev, isGeminiSpeaking: false }));
  }, []);

  const connect = useCallback(() => {
    return new Promise<void>((resolve, reject) => {
      const ws = new WebSocket(optionsRef.current.wsUrl);
      let resolved = false;

      ws.onopen = () => {
        if (resolved) return;
        resolved = true;
        wsRef.current = ws;
        setState((prev) => ({ ...prev, isConnected: true, error: null }));
        resolve();
      };

      ws.onerror = () => {
        if (!resolved) {
          resolved = true;
          setState((prev) => ({
            ...prev,
            error:
              'Cannot connect to voice server. Start the backend with: cd clarity-engine-py && .venv/bin/uvicorn main:app --port 8000',
          }));
          reject(new Error('WebSocket connection failed'));
        }
      };

      ws.onclose = (event) => {
        wsRef.current = null;
        setState((prev) => ({ ...prev, isConnected: false }));
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
        try {
          const data = JSON.parse(event.data as string);

          switch (data.type) {
            case 'audio':
              queueAudioChunk(data.data);
              break;
            case 'user_transcript':
              // Ignore — Gemini's transcription is unreliable (syllable splits); we use Web Speech API
              break;
            case 'gemini_transcript':
              setState((prev) => ({
                ...prev,
                geminiTranscript: (prev.geminiTranscript + ' ' + (data.text || '')).trim(),
              }));
              break;
            case 'transcript':
              setState((prev) => ({
                ...prev,
                geminiTranscript: (prev.geminiTranscript + ' ' + (data.text || '')).trim(),
              }));
              break;
            case 'turn_complete':
              // Worklet will send playback_stopped when buffer drains
              break;
            case 'interrupted':
              if (workletNodeRef.current) {
                workletNodeRef.current.port.postMessage({ type: 'clear' });
              }
              setState((prev) => ({ ...prev, isGeminiSpeaking: false }));
              break;
            case 'graph':
              setState((prev) => ({ ...prev, isAnalyzing: true }));
              if (data.data?.propositions || data.data?.relationships) {
                const ps = (toCamelCase(data.data.propositions ?? []) as Proposition[]) ?? [];
                const rels = (toCamelCase(data.data.relationships ?? []) as Relationship[]) ?? [];
                const round = data.data?.round ?? 1;
                const degraded = data.data?.degraded === true;
                optionsRef.current.onGraph({ propositions: ps, relationships: rels, round, degraded });
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
            case 'analysis_complete':
              setState((prev) => ({ ...prev, isAnalyzing: false }));
              optionsRef.current.onAnalysisComplete();
              break;
            case 'error':
              setState((prev) => ({ ...prev, error: data.message }));
              break;
            case 'gemini_error':
              console.warn('Gemini Live session ended:', data.message);
              setState((prev) => ({
                ...prev,
                isGeminiSpeaking: false,
                isConnected: false,
              }));
              break;
          }
        } catch (parseErr) {
          console.warn('Failed to parse WebSocket message:', event.data);
        }
      };
    });
  }, [queueAudioChunk]);

  const startRecording = useCallback(async () => {
    try {
      await initAudioPlayback();

      setState((prev) => ({
        ...prev,
        error: null,
        userTranscript: '',
        geminiTranscript: '',
      }));

      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
        await connect();
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: 16000,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
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
            const s = Math.max(-1, Math.min(1, inputData[i]));
            int16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
          }
          const uint8 = new Uint8Array(int16.buffer);
          let binary = '';
          for (let i = 0; i < uint8.length; i++) {
            binary += String.fromCharCode(uint8[i]);
          }
          const base64 = btoa(binary);
          wsRef.current.send(JSON.stringify({ type: 'audio', data: base64 }));
        }
      };

      source.connect(processor);
      processor.connect(audioContext.destination);

      setState((prev) => ({ ...prev, isRecording: true }));
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('Recording error:', err);
      setState((prev) => ({
        ...prev,
        error:
          (err as { name?: string })?.name === 'NotAllowedError'
            ? 'Microphone access denied. Please allow microphone access.'
            : message.includes('WebSocket') || message.includes('connection')
              ? 'Cannot connect to voice server. Make sure the backend is running (port 8000) and try again.'
              : `Failed to start recording: ${message}`,
      }));
    }
  }, [connect, initAudioPlayback]);

  const stopAndAnalyze = useCallback((_userText?: string, _roundNumber?: number) => {
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

    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    if (workletNodeRef.current) {
      workletNodeRef.current.port.postMessage({ type: 'clear' });
    }

    setState((prev) => ({
      ...prev,
      isRecording: false,
      isConnected: false,
      isGeminiSpeaking: false,
    }));
  }, []);

  useEffect(() => {
    return () => {
      if (wsRef.current) wsRef.current.close();
      if (mediaStreamRef.current) mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      if (audioContextRef.current) audioContextRef.current.close();
      if (playbackContextRef.current) playbackContextRef.current.close();
    };
  }, []);

  return {
    ...state,
    startRecording,
    stopAndAnalyze,
    stopPlayback,
    initAudioPlayback,
    queueAudioChunk,
  };
}
