'use client';

import { useState, useRef, useCallback } from 'react';

export function useVoiceRecording() {
  const [isRecording, setIsRecording] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const onAudioDataRef = useRef<((data: Blob) => void) | null>(null);

  const startRecording = useCallback(
    async (onAudioData: (data: Blob) => void) => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            sampleRate: 16000,
          },
        });

        streamRef.current = stream;
        onAudioDataRef.current = onAudioData;

        // Audio context for visualization
        const audioContext = new AudioContext();
        const analyser = audioContext.createAnalyser();
        const source = audioContext.createMediaStreamSource(stream);

        source.connect(analyser);
        analyser.fftSize = 256;

        audioContextRef.current = audioContext;
        analyserRef.current = analyser;

        // Visualize audio level
        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        const updateLevel = () => {
          if (!analyserRef.current) return;

          analyserRef.current.getByteFrequencyData(dataArray);
          const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
          setAudioLevel(average / 255);

          if (isRecording) {
            requestAnimationFrame(updateLevel);
          }
        };
        updateLevel();

        // MediaRecorder
        const mediaRecorder = new MediaRecorder(stream, {
          mimeType: 'audio/webm',
        });

        mediaRecorderRef.current = mediaRecorder;

        mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0 && onAudioDataRef.current) {
            onAudioDataRef.current(event.data);
          }
        };

        mediaRecorder.start(250);
        setIsRecording(true);

        console.log('[Voice] Recording started');
      } catch (error) {
        console.error('[Voice] Error starting recording:', error);
        alert('Could not access microphone. Please check permissions.');
      }
    },
    [isRecording]
  );

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);

      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }

      setAudioLevel(0);
      console.log('[Voice] Recording stopped');
    }
  }, [isRecording]);

  return {
    isRecording,
    audioLevel,
    startRecording,
    stopRecording,
  };
}
