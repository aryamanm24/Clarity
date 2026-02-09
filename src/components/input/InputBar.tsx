'use client';

import { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, Keyboard, Square, ArrowRight } from 'lucide-react';
import { useSpeechRecognition } from '@/hooks/useSpeechRecognition';
import type { EngineType } from '@/lib/types';
import { colors, fonts } from '@/lib/design-tokens';

type GeminiLiveHook = ReturnType<typeof import('@/hooks/useGeminiLive').useGeminiLive>;

interface InputBarProps {
  onAnalyze: (input: string, engines?: EngineType[]) => void;
  isAnalyzing: boolean;
  analysisPhase?: 'parsing' | 'analyzing' | 'complete' | 'error' | 'idle';
  hasPropositions?: boolean;
  initialValue?: string;
  onInitialValueConsumed?: () => void;
  geminiLive?: GeminiLiveHook;
  onStopVoice?: (getTranscript: () => string) => void;
  /** When false (voice mode collapsed), show minimal "Add more reasoning" pill */
  micBarExpanded?: boolean;
  onMicBarExpand?: () => void;
}

export const InputBar = ({
  onAnalyze,
  isAnalyzing,
  analysisPhase = 'idle',
  hasPropositions = false,
  initialValue = '',
  onInitialValueConsumed,
  geminiLive,
  onStopVoice,
  micBarExpanded = true,
  onMicBarExpand,
}: InputBarProps) => {
  const [input, setInput] = useState('');
  const [inputMode, setInputMode] = useState<'text' | 'voice'>('text');
  const [mounted, setMounted] = useState(false);
  const [transcriptExpanded, setTranscriptExpanded] = useState(true);
  useEffect(() => setMounted(true), []);

  // Auto-collapse transcript when analysis starts (saves space for graph)
  useEffect(() => {
    if (isAnalyzing) {
      setTranscriptExpanded(false);
    }
  }, [isAnalyzing]);

  // Sync initial value from parent (e.g. suggestion pill click)
  useEffect(() => {
    if (initialValue) {
      setInputMode('text');
      setInput(initialValue);
      onInitialValueConsumed?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialValue]);

  const speechRecognition = useSpeechRecognition();
  const {
    transcript,
    interimTranscript,
    isListening,
    isSupported,
    startListening,
    stopListening,
    resetTranscript,
  } = speechRecognition;

  // Use Gemini Live when provided, else fall back to Web Speech API only
  const useGeminiLive = !!geminiLive;
  const gl = geminiLive;

  useEffect(() => {
    if (transcript) {
      setInput(transcript);
    }
  }, [transcript]);

  const handleSubmit = useCallback(() => {
    const text = input.trim();
    if (!text || isAnalyzing) return;
    onAnalyze(text);
    setInput('');
    resetTranscript();
    if (isListening) stopListening();
  }, [input, isAnalyzing, onAnalyze, resetTranscript, isListening, stopListening]);

  const handleAnalyzeFromVoice = useCallback(() => {
    const text = (transcript || '').trim();
    if (!text || isAnalyzing) return;
    onAnalyze(text);
    setInput('');
    resetTranscript();
    stopListening();
  }, [transcript, isAnalyzing, onAnalyze, resetTranscript, stopListening]);

  const displayText = input || '';
  const hasInput = displayText.trim().length > 0 || interimTranscript.length > 0;

  const spokenText = (transcript || '').trim() + (interimTranscript || '').trim();

  return (
    <div className="sticky bottom-0 z-10 border-t border-gray-200 dark:border-white/10 bg-white/95 dark:bg-gray-950/90 backdrop-blur-xl">
      <div className="max-w-5xl mx-auto px-4 py-4">
        <AnimatePresence mode="wait">
          {isAnalyzing ? (
            <motion.div
              key="collapsed"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="flex h-12 w-12 mx-auto items-center justify-center rounded-full bg-white/[0.05] border border-white/[0.1]"
              aria-label="Analyzing"
            >
              <div className="h-5 w-5 rounded-full border-2 border-white/30 border-t-blue-400 animate-spin" />
            </motion.div>
          ) : useGeminiLive && gl && !micBarExpanded && hasPropositions ? (
            /* COLLAPSED — "Add more reasoning" pill */
            <motion.div key="collapsed-mic" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex justify-center">
              <button
                onClick={() => {
                  setInputMode('voice');
                  onMicBarExpand?.();
                }}
                className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-gray-900/90 dark:bg-gray-900/90 backdrop-blur-sm border border-white/10 text-sm text-gray-400 hover:text-white hover:border-white/20 transition-all duration-200 shadow-lg"
              >
                🎙️ Add more reasoning
              </button>
            </motion.div>
          ) : inputMode === 'text' ? (
            /* TEXT MODE */
            <motion.div
              key="text"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex items-center gap-3 w-full max-w-4xl mx-auto"
            >
              {mounted && (isSupported || useGeminiLive) && (
                <button
                  onClick={() => setInputMode('voice')}
                  className="p-3 rounded-full bg-gray-100 dark:bg-white/[0.05] border border-gray-200 dark:border-white/[0.1] hover:bg-gray-200 dark:hover:bg-white/[0.1] transition-colors text-gray-600 dark:text-gray-400 dark:hover:text-white"
                  title="Switch to voice input"
                >
                  <Mic className="w-5 h-5" />
                </button>
              )}
              <input
                type="text"
                value={displayText}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
                placeholder="Share a thought, decision, or argument..."
                className="flex-1 bg-gray-50 dark:bg-white/[0.05] border border-gray-200 dark:border-white/[0.1] rounded-full px-5 py-3 text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 transition-all"
                style={{ fontFamily: fonts.ui }}
              />
              <button
                onClick={handleSubmit}
                disabled={!hasInput}
                className="p-3 rounded-full bg-blue-600 hover:bg-blue-500 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <ArrowRight className="w-5 h-5 text-white" />
              </button>
            </motion.div>
          ) : useGeminiLive && gl ? (
            /* VOICE MODE — compact pill (same size as Add more reasoning) */
            <motion.div key="voice" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center gap-2">
              {spokenText && gl.isRecording && (
                <div className="max-w-md px-4 py-2 rounded-xl bg-gray-900/90 dark:bg-gray-900/90 backdrop-blur-sm border border-white/10 text-xs text-gray-400 truncate">
                  {spokenText.slice(-100)}
                </div>
              )}
              <div className="flex items-center gap-3 px-4 py-2.5 rounded-full bg-gray-900/90 dark:bg-gray-900/90 backdrop-blur-sm border border-white/10 shadow-lg">
                <button onClick={() => setInputMode('text')} className="text-gray-500 hover:text-white transition-colors" title="Switch to keyboard">
                  <Keyboard className="w-4 h-4" />
                </button>
                {!gl.isRecording ? (
                  <button
                    onClick={async () => {
                      resetTranscript();
                      startListening();
                      await gl.startRecording();
                    }}
                    disabled={gl.isAnalyzing}
                    className="w-10 h-10 rounded-full flex items-center justify-center bg-blue-500 hover:bg-blue-600 disabled:opacity-30 transition-all shadow-lg shadow-blue-500/25"
                  >
                    <Mic className="w-4 h-4 text-white" />
                  </button>
                ) : (
                  <button
                    onClick={() => {
                      stopListening();
                      const getTranscript = () => (transcript + ' ' + interimTranscript).trim();
                      onStopVoice?.(getTranscript);
                    }}
                    className="w-10 h-10 rounded-full flex items-center justify-center bg-red-500 hover:bg-red-600 transition-all animate-pulse shadow-lg shadow-red-500/25"
                  >
                    <Square className="w-4 h-4 text-white" />
                  </button>
                )}
                <span className="text-xs text-gray-500 min-w-[80px]">
                  {gl.isRecording ? (
                    <span className="text-red-400 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 bg-red-400 rounded-full animate-pulse" />
                      Listening...
                    </span>
                  ) : (
                    'Tap to speak'
                  )}
                </span>
              </div>
              {gl.error && <p className="text-xs text-red-400">{gl.error}</p>}
            </motion.div>
          ) : (
            /* VOICE MODE — Web Speech API fallback */
            <motion.div
              key="voice"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center gap-3"
            >
              {(interimTranscript || transcript) && (
                <div className="w-full max-w-2xl rounded-xl bg-white/[0.03] dark:bg-white/[0.03] border border-white/[0.06] dark:border-white/[0.06] p-3 max-h-32 overflow-y-auto text-center">
                  <p className="text-sm text-gray-600 dark:text-gray-400 italic">
                    {transcript}
                    {interimTranscript && (
                      <span className="text-gray-500 dark:text-gray-500">{interimTranscript}</span>
                    )}
                  </p>
                </div>
              )}
              <div className="flex items-center gap-4">
                <button
                  onClick={() => {
                    setInputMode('text');
                    if (isListening) stopListening();
                  }}
                  className="p-2 rounded-full text-gray-500 hover:text-gray-900 dark:hover:text-white transition-colors"
                  title="Switch to text input"
                >
                  <Keyboard className="w-5 h-5" />
                </button>
                {!isListening ? (
                  <button
                    onClick={() => {
                      setInput('');
                      resetTranscript();
                      startListening();
                    }}
                    disabled={!isSupported}
                    className="p-5 rounded-full bg-blue-600 hover:bg-blue-500 transition-all hover:scale-105 shadow-lg shadow-blue-500/20 disabled:opacity-50"
                  >
                    <Mic className="w-7 h-7 text-white" />
                  </button>
                ) : (
                  <button
                    onClick={() => {
                      stopListening();
                      handleAnalyzeFromVoice();
                    }}
                    className="p-5 rounded-full bg-red-600 hover:bg-red-500 transition-all animate-pulse shadow-lg shadow-red-500/20"
                  >
                    <Square className="w-7 h-7 text-white" />
                  </button>
                )}
                {isListening && transcript.trim() && (
                  <button
                    onClick={() => {
                      const current = transcript.trim();
                      setInput('');
                      resetTranscript();
                      onAnalyze(current);
                    }}
                    className="px-4 py-2 rounded-full bg-emerald-600 hover:bg-emerald-500 text-sm text-white transition-colors"
                  >
                    Analyze so far →
                  </button>
                )}
              </div>
              <p className="text-xs text-gray-600 dark:text-gray-500">
                {isListening
                  ? 'Listening... Click stop when done, or "Analyze so far" to see partial results'
                  : 'Click the microphone to start speaking'}
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};
