'use client';

import { Suspense, useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Header } from '@/components/layout/Header';
import { ClarityGraph } from '@/components/graph/ClarityGraph';
import { InputBar } from '@/components/input/InputBar';
import { FormalProofViewer } from '@/components/proof/FormalProofViewer';
import { CircularReasoningViewer } from '@/components/proof/CircularReasoningViewer';
import { useAnalysisStream } from '@/hooks/useAnalysisStream';
import { useGeminiLive } from '@/hooks/useGeminiLive';
import type { EngineType } from '@/lib/types';

const SUGGESTIONS = ['Should I change careers?', 'Is this business idea viable?', 'Evaluate my decision'];

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8000/ws/voice';
const EXPLAIN_WS_URL = process.env.NEXT_PUBLIC_WS_URL?.replace('/ws/voice', '/ws/explain') || 'ws://localhost:8000/ws/explain';

function AnalyzePageContent() {
  const searchParams = useSearchParams();
  const { graphState, isAnalyzing, analysisPhase, error, startAnalysis, reset, applyVoiceResult, triggerVoiceAnalysis } =
    useAnalysisStream();
  const [conversationHistory, setConversationHistory] = useState<string[]>([]);

  const [cachedExplanation, setCachedExplanation] = useState('');
  const [isExplanationReady, setIsExplanationReady] = useState(false);

  const geminiLive = useGeminiLive({
    wsUrl: WS_URL,
    onGraph: (data) =>
      applyVoiceResult({
        propositions: data.propositions,
        relationships: data.relationships,
        round: data.round,
        degraded: data.degraded,
      }),
    onContradictions: (data) => applyVoiceResult({ contradictions: data }),
    onFallacies: (data) => applyVoiceResult({ fallacies: data }),
    onInsights: (data) => applyVoiceResult({ insights: data }),
    onAnalysisComplete: () => {},
    onPlaybackStopped: () => setIsClarityExplaining(false),
  });

  const [micBarExpanded, setMicBarExpanded] = useState(true);
  const [isClarityExplaining, setIsClarityExplaining] = useState(false);
  const [clarityExplanation, setClarityExplanation] = useState('');

  const handleVoiceStart = useCallback(async (): Promise<void> => {
    setSelectedNodeId(null);
    await geminiLive.startRecording();
  }, [geminiLive.startRecording]);

  const handleStopVoice = useCallback(
    (getTranscript: () => string) => {
      const transcript = getTranscript().trim();
      if (!transcript) {
        geminiLive.stopAndAnalyze();
        return;
      }

      setClarityExplanation('');
      window.speechSynthesis?.cancel();
      setMicBarExpanded(false);

      geminiLive.stopAndAnalyze();

      const updatedHistory = [...conversationHistory, transcript];
      setConversationHistory(updatedHistory);
      const fullText = updatedHistory.join('\n\n');
      console.log(`📝 Round ${updatedHistory.length}: sending ${fullText.length} chars for analysis (SSE)`);
      triggerVoiceAnalysis(fullText, updatedHistory.length);
    },
    [conversationHistory, geminiLive, triggerVoiceAnalysis]
  );

  const handleClear = useCallback(() => {
    reset();
    setSelectedNodeId(null);
    setConversationHistory([]);
    setClarityExplanation('');
    setCachedExplanation('');
    setIsExplanationReady(false);
    setMicBarExpanded(true);
    window.speechSynthesis?.cancel();
  }, [reset]);

  const preGenerateExplanation = useCallback(async () => {
    if (graphState.propositions.length === 0) return;
    try {
      const payload = {
        contradictions: graphState.contradictions ?? [],
        fallacies: graphState.fallacies ?? [],
        insights: graphState.insights ?? [],
        round: conversationHistory.length,
        userText: conversationHistory.join('\n\n'),
      };
      const response = await fetch('/api/generate-explanation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (data.explanation) {
        setCachedExplanation(data.explanation);
        setIsExplanationReady(true);
        console.log('✅ Explanation pre-generated:', data.explanation.slice(0, 60));
      }
    } catch (err) {
      console.error('Pre-generation failed:', err);
    }
  }, [
    graphState.propositions.length,
    graphState.contradictions,
    graphState.fallacies,
    graphState.insights,
    conversationHistory,
  ]);

  useEffect(() => {
    if (analysisPhase === 'complete' && graphState.propositions.length > 0) {
      setCachedExplanation('');
      setIsExplanationReady(false);
      preGenerateExplanation();
    }
  }, [analysisPhase, graphState.propositions.length, preGenerateExplanation]);

  // Accumulate-then-play: collect all audio chunks, play as one buffer (no AudioWorklet dependency)
  const audioChunksRef = useRef<Uint8Array[]>([]);
  const hasStartedPlaybackRef = useRef(false);

  const playAccumulatedAudio = useCallback(async () => {
    const chunks = audioChunksRef.current;
    if (chunks.length === 0) {
      console.warn('No audio chunks to play');
      setIsClarityExplaining(false);
      return;
    }

    console.log(`🔊 Playing ${chunks.length} accumulated chunks as one buffer...`);

    let totalLength = 0;
    for (const chunk of chunks) {
      totalLength += chunk.length;
    }

    const combined = new Uint8Array(totalLength);
    let offset = 0;
    for (const chunk of chunks) {
      combined.set(chunk, offset);
      offset += chunk.length;
    }

    const int16 = new Int16Array(combined.buffer, 0, Math.floor(combined.length / 2));
    const float32 = new Float32Array(int16.length);
    for (let i = 0; i < int16.length; i++) {
      float32[i] = int16[i] / 32768.0;
    }

    try {
      const ctx = new AudioContext({ sampleRate: 24000 });
      if (ctx.state === 'suspended') {
        await ctx.resume();
      }

      const audioBuffer = ctx.createBuffer(1, float32.length, 24000);
      audioBuffer.getChannelData(0).set(float32);

      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(ctx.destination);

      source.onended = () => {
        console.log('🔊 Playback complete');
        setIsClarityExplaining(false);
      };

      source.start();
      console.log(`🔊 Playing ${float32.length} samples (${(float32.length / 24000).toFixed(1)}s)`);
    } catch (err) {
      console.error('❌ Audio playback error:', err);
      setIsClarityExplaining(false);
    }

    audioChunksRef.current = [];
  }, []);

  const buildAnalysisSummary = useCallback((): string => {
    const parts: string[] = [];
    const round = conversationHistory.length;
    const userText = conversationHistory[conversationHistory.length - 1] ?? '';
    parts.push(`The user said: "${userText.slice(0, 200)}"`);
    if (round > 1) parts.push('This is a follow-up round. Only mention what is new.');
    const contradictions = graphState.contradictions ?? [];
    const fallacies = graphState.fallacies ?? [];
    const insights = graphState.insights ?? [];
    if (contradictions.length > 0) {
      parts.push(`\nContradictions found (${contradictions.length}):`);
      contradictions.slice(0, 2).forEach((c) => {
        const desc = (c as { description?: string; explanation?: string }).description ?? (c as { description?: string; explanation?: string }).explanation ?? '';
        parts.push(`- ${typeof desc === 'string' ? desc.slice(0, 150) : ''}`);
      });
    }
    if (fallacies.length > 0) {
      parts.push(`\nFallacies (${fallacies.length}):`);
      fallacies.slice(0, 2).forEach((f) => {
        const name = (f as { name?: string; type?: string }).name ?? (f as { name?: string; type?: string }).type ?? '';
        const desc = (f as { description?: string; explanation?: string }).description ?? (f as { description?: string; explanation?: string }).explanation ?? '';
        parts.push(`- ${name}: ${typeof desc === 'string' ? desc.slice(0, 100) : ''}`);
      });
    }
    if (insights.length > 0) {
      parts.push('\nKey insights:');
      insights.slice(0, 2).forEach((ins) => {
        const text = typeof ins === 'string' ? ins : (ins as { text?: string; content?: string }).text ?? (ins as { text?: string; content?: string }).content ?? '';
        parts.push(`- ${typeof text === 'string' ? text.slice(0, 120) : ''}`);
      });
    }
    if (contradictions.length === 0 && fallacies.length === 0) {
      parts.push('\nNo major contradictions or fallacies found. The reasoning appears logically consistent.');
    }
    return parts.join('\n');
  }, [graphState.contradictions, graphState.fallacies, graphState.insights, conversationHistory]);

  const handleAskClarity = useCallback(async () => {
    if (!cachedExplanation) {
      console.warn('❌ No cached explanation');
      return;
    }

    setIsClarityExplaining(true);
    setClarityExplanation('CLARITY is speaking...');
    audioChunksRef.current = [];
    hasStartedPlaybackRef.current = false;

    console.log('🎙️ [1/6] Ask CLARITY clicked');
    console.log('🎙️ [2/6] Opening WebSocket to /ws/explain...');

    try {
      const ws = new WebSocket(EXPLAIN_WS_URL);

      ws.onopen = () => {
        console.log('✅ [3/6] WebSocket connected, sending explanation...');
        ws.send(JSON.stringify({ summary: cachedExplanation, mode: 'read_aloud' }));
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data as string);

          if (data.type === 'audio') {
            const binaryStr = atob(data.data);
            const bytes = new Uint8Array(binaryStr.length);
            for (let i = 0; i < binaryStr.length; i++) {
              bytes[i] = binaryStr.charCodeAt(i);
            }
            audioChunksRef.current.push(bytes);
          } else if (data.type === 'turn_complete') {
            console.log(`✅ [4/6] Turn complete — received ${audioChunksRef.current.length} chunks`);
            console.log('🔊 [5/6] Playing accumulated audio as one buffer...');
            hasStartedPlaybackRef.current = true;
            playAccumulatedAudio();
          } else if (data.type === 'error') {
            console.error('❌ Explain error:', data.message);
            setIsClarityExplaining(false);
            setClarityExplanation('Check the sidebar for details.');
          }
        } catch {
          // ignore parse errors
        }
      };

      ws.onerror = () => {
        console.error('❌ WebSocket error');
        setIsClarityExplaining(false);
        setClarityExplanation('Could not connect. Check the sidebar for details.');
      };

      ws.onclose = (event) => {
        console.log(`🔌 [6/6] WebSocket closed (code: ${event.code}, reason: ${event.reason || 'none'})`);
        console.log(`📊 Final stats: ${audioChunksRef.current.length} chunks`);

        if (audioChunksRef.current.length > 0) {
          console.log('🎙️ WebSocket closed before turn_complete, playing accumulated audio...');
          hasStartedPlaybackRef.current = true;
          playAccumulatedAudio();
        } else if (!hasStartedPlaybackRef.current) {
          setIsClarityExplaining(false);
        }
      };
    } catch (err) {
      console.error('❌ Ask CLARITY failed:', err);
      setClarityExplanation("I couldn't generate an explanation right now. Check the sidebar for details.");
      setIsClarityExplaining(false);
    }
  }, [cachedExplanation, playAccumulatedAudio]);

  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [isPanelOpen, setIsPanelOpen] = useState(true);
  const [textInput, setTextInput] = useState('');

  // Auto-analyze if query param exists (only on mount / when query changes — avoid re-running and resetting graph)
  const queryParam = searchParams.get('q');
  useEffect(() => {
    if (queryParam) {
      handleAnalyze(queryParam);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryParam]);

  const handleAnalyze = (input: string, _engines?: EngineType[]) => {
    reset();
    setSelectedNodeId(null);
    setConversationHistory([]);
    startAnalysis(input, ['adversarial', 'assumption', 'precision', 'signal']);
  };

  const hasResults =
    graphState.propositions.length > 0 ||
    (conversationHistory.length > 0 && (isAnalyzing || geminiLive.isAnalyzing));
  
  // Separate contradictions and fallacies
  const satContradictions = graphState.contradictions.filter(
    c => c.formalProof || (c as any).formal_proof
  );
  const circularFallacies = graphState.fallacies.filter(
    f => (f.patternType || (f as any).pattern_type) === 'circular'
  );

  return (
    <div className="h-screen flex flex-col bg-gray-50 dark:bg-[#0d0e10] transition-colors overflow-hidden">
      <Header />
      
      <main className="flex-1 flex flex-col min-h-0 overflow-hidden">
        {/* Error banner — never show raw coroutine/backend strings */}
        {error && typeof error === 'string' && !error.includes('coroutine object') && (
          <div className="shrink-0 border-b border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/30 px-4 py-2 text-sm text-red-700 dark:text-red-300">
            {error}
          </div>
        )}

        {/* Main content area — graph fills space */}
        <div className="flex-1 flex min-h-0 overflow-hidden">
          {/* Graph Canvas — full height */}
          <div
            className={`flex-1 min-w-0 relative ${
              !hasResults && !isAnalyzing && conversationHistory.length === 0
                ? 'flex items-center justify-center'
                : ''
            }`}
          >
            {/* Floating controls — overlay on graph */}
            {hasResults && (
              <div className="absolute top-4 right-4 z-10 flex items-center justify-end gap-3 pointer-events-none">
                {graphState.propositions.length > 0 && !isAnalyzing && !geminiLive.isAnalyzing && (
                  <button
                    onClick={handleAskClarity}
                    disabled={isClarityExplaining || !isExplanationReady}
                    className={`pointer-events-auto flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                      isClarityExplaining
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                        : isExplanationReady
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/20'
                          : 'bg-gray-800/50 text-gray-500 border border-gray-700 cursor-not-allowed'
                    }`}
                  >
                    {isClarityExplaining ? (
                      <>
                        <div className="flex gap-0.5 items-end h-3">
                          {[6, 8, 10, 7].map((h, i) => (
                            <div
                              key={i}
                              className="w-0.5 bg-emerald-400 rounded-full animate-pulse"
                              style={{ height: `${h}px`, animationDelay: `${i * 0.15}s` }}
                            />
                          ))}
                        </div>
                        <span>Speaking...</span>
                      </>
                    ) : isExplanationReady ? (
                      <>🎙️ Ask CLARITY</>
                    ) : (
                      <>⏳ Preparing...</>
                    )}
                  </button>
                )}
                <button
                  onClick={handleClear}
                  className="pointer-events-auto px-4 py-2 text-sm font-medium text-gray-300 bg-white/[0.05] border border-white/[0.1] rounded-lg hover:bg-white/[0.1] transition-colors"
                >
                  Clear
                </button>
              </div>
            )}
            {hasResults ? (
              <ClarityGraph
                graphState={graphState}
                onNodeSelect={setSelectedNodeId}
                selectedNodeId={selectedNodeId}
                isAnalyzing={isAnalyzing}
              />
            ) : isAnalyzing || geminiLive.isAnalyzing ? (
              <div className="text-center py-12">
                <div className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/30 mb-4">
                  <div className="h-6 w-6 rounded-full border-2 border-blue-300 dark:border-blue-600 border-t-blue-600 dark:border-t-blue-400 animate-spin" />
                </div>
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-1">
                  Analyzing your reasoning
                </h2>
                <div className="flex items-center justify-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {analysisPhase === 'parsing' && 'Parsing argument structure...'}
                    {analysisPhase === 'analyzing' && 'Running analysis engines...'}
                    {!['parsing', 'analyzing'].includes(analysisPhase ?? '') && 'Mapping structure and checking logic...'}
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center max-w-md">
                  <div className="text-4xl mb-4">🧠</div>
                  <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Ready to Analyze</h2>
                  <p className="text-sm text-gray-600 dark:text-gray-500 mb-6">
                    Type or speak an argument below. CLARITY will map your reasoning,
                    surface hidden assumptions, and detect logical contradictions.
                  </p>
                  <div className="flex flex-wrap justify-center gap-2">
                    {SUGGESTIONS.map((suggestion) => (
                      <button
                        key={suggestion}
                        onClick={() => setTextInput(suggestion)}
                        className="px-4 py-2 rounded-full bg-gray-100 dark:bg-white/[0.05] border border-gray-200 dark:border-white/[0.1] text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-200 dark:hover:bg-white/[0.1] transition-all"
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Right Sidebar — glassmorphism matching graph canvas */}
          {hasResults && isPanelOpen && (
            <div className="w-[380px] shrink-0 h-full overflow-y-auto border-l border-gray-200 dark:border-white/10 bg-white/80 dark:bg-gray-950/60 backdrop-blur-xl">
              <div className="p-5 space-y-4">
                {/* Analysis Summary card — glass */}
                <div className="rounded-xl bg-white dark:bg-white/[0.03] border border-gray-200 dark:border-white/[0.06] p-5">
                  <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4">
                    Analysis Summary
                  </h3>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-lg bg-gray-50 dark:bg-white/[0.04] border border-gray-200 dark:border-white/[0.06] p-3 text-center">
                      <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{graphState.propositions.length}</div>
                      <div className="text-xs text-gray-500 mt-1">Propositions</div>
                    </div>
                    <div className="rounded-lg bg-gray-50 dark:bg-white/[0.04] border border-gray-200 dark:border-white/[0.06] p-3 text-center">
                      <div className="text-2xl font-bold text-red-600 dark:text-red-400">{graphState.contradictions.length}</div>
                      <div className="text-xs text-gray-500 mt-1">Contradictions</div>
                    </div>
                    <div className="rounded-lg bg-gray-50 dark:bg-white/[0.04] border border-gray-200 dark:border-white/[0.06] p-3 text-center">
                      <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">{graphState.fallacies.length}</div>
                      <div className="text-xs text-gray-500 mt-1">Fallacies</div>
                    </div>
                    <div className="rounded-lg bg-gray-50 dark:bg-white/[0.04] border border-gray-200 dark:border-white/[0.06] p-3 text-center">
                      <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{graphState.insights.length}</div>
                      <div className="text-xs text-gray-500 mt-1">Insights</div>
                    </div>
                  </div>
                </div>

                {/* Contradictions — red-tinted glass */}
                <AnimatePresence>
                  {satContradictions.length > 0 && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3 }}
                      className="rounded-xl bg-red-500/[0.06] dark:bg-red-500/[0.06] border border-red-500/20 dark:border-red-500/20 p-5"
                    >
                      <div className="flex items-center gap-2 mb-4">
                        <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                        <h3 className="text-sm font-semibold text-red-400 uppercase tracking-wider">
                          Logical Contradictions ({satContradictions.length})
                        </h3>
                      </div>
                      {satContradictions.map(contradiction => (
                        <FormalProofViewer
                          key={contradiction.id}
                          contradiction={contradiction}
                          propositions={graphState.propositions}
                          variant="glass"
                        />
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Fallacies — amber-tinted glass */}
                <AnimatePresence>
                  {circularFallacies.length > 0 && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3 }}
                      className="rounded-xl bg-amber-500/[0.06] dark:bg-amber-500/[0.06] border border-amber-500/20 dark:border-amber-500/20 p-5"
                    >
                      <div className="flex items-center gap-2 mb-4">
                        <div className="w-2 h-2 rounded-full bg-amber-500" />
                        <h3 className="text-sm font-semibold text-amber-400 uppercase tracking-wider">
                          Fallacies ({circularFallacies.length})
                        </h3>
                      </div>
                      {circularFallacies.map(fallacy => (
                        <CircularReasoningViewer
                          key={fallacy.id}
                          fallacy={fallacy}
                          propositions={graphState.propositions}
                          variant="glass"
                        />
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Insights — neutral glass */}
                <AnimatePresence>
                  {graphState.insights.length > 0 && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3 }}
                      className="rounded-xl bg-white/[0.03] dark:bg-white/[0.03] border border-white/[0.06] dark:border-white/[0.06] p-5"
                    >
                      <div className="flex items-center gap-2 mb-4">
                        <div className="w-2 h-2 rounded-full bg-blue-500" />
                        <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">
                          Insights ({graphState.insights.length})
                        </h3>
                      </div>
                      <div className="space-y-3">
                        {graphState.insights.map((insight, i) => (
                          <div key={insight.id ?? i} className="mb-3 last:mb-0 rounded-lg bg-white/[0.02] dark:bg-white/[0.02] border border-white/[0.04] dark:border-white/[0.04] p-4 border-l-2 border-l-blue-500/40">
                            <div className="flex items-start gap-3">
                              <span className="text-xs font-mono text-blue-400/60 mt-0.5 shrink-0">
                                {String(i + 1).padStart(2, '0')}
                              </span>
                              <p className="text-sm text-gray-300 dark:text-gray-300 leading-relaxed">
                                {typeof insight === 'string' ? insight : insight.content ?? (insight as { text?: string }).text ?? (insight as { description?: string }).description ?? ''}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          )}
        </div>

        {/* Floating speaking indicator — compact pill, doesn't block graph (hide when user is speaking) */}
        {(geminiLive.isGeminiSpeaking || geminiLive.geminiTranscript) && !geminiLive.isRecording && (
          <div
            className="fixed bottom-24 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2 px-4 py-2 rounded-full bg-gray-900/90 backdrop-blur-sm border border-white/10 shadow-lg max-w-md"
          >
            {geminiLive.isGeminiSpeaking && (
              <div className="flex gap-0.5 items-end h-3 shrink-0">
                {[6, 8, 10, 7].map((h, i) => (
                  <div
                    key={i}
                    className="w-0.5 bg-emerald-400 rounded-full animate-pulse"
                    style={{
                      height: `${h}px`,
                      animationDelay: `${i * 0.15}s`,
                    }}
                  />
                ))}
              </div>
            )}
            <span className="text-xs text-gray-300 truncate">
              {geminiLive.geminiTranscript
                ? geminiLive.geminiTranscript.slice(-80)
                : 'CLARITY is speaking...'}
            </span>
            <button
              onClick={geminiLive.stopPlayback}
              className="text-xs text-gray-500 hover:text-white shrink-0 ml-1"
            >
              ✕
            </button>
          </div>
        )}

        {/* CLARITY explanation — floating pill (from Ask CLARITY button, Gemini Live voice) */}
        {(clarityExplanation || isClarityExplaining) && (
          <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-30 flex items-center gap-3 px-5 py-3 rounded-2xl bg-gray-900/95 backdrop-blur-sm border border-emerald-500/20 shadow-xl max-w-lg animate-in fade-in slide-in-from-bottom-2 duration-300">
            {isClarityExplaining && (
              <div className="flex gap-0.5 items-end h-3 shrink-0">
                {[6, 8, 10, 7].map((h, i) => (
                  <div
                    key={i}
                    className="w-0.5 bg-emerald-400 rounded-full animate-pulse"
                    style={{ height: `${h}px`, animationDelay: `${i * 0.15}s` }}
                  />
                ))}
              </div>
            )}
            <p className="text-sm text-gray-200 leading-relaxed">{clarityExplanation || 'CLARITY is speaking...'}</p>
            <button
              onClick={() => {
                geminiLive.stopPlayback();
                setClarityExplanation('');
                setIsClarityExplaining(false);
              }}
              className="text-gray-500 hover:text-white shrink-0 ml-1"
            >
              ✕
            </button>
          </div>
        )}

        {/* Input Bar — sticky bottom, dual-mode text/voice */}
        <InputBar
          onAnalyze={handleAnalyze}
          isAnalyzing={isAnalyzing || geminiLive.isAnalyzing}
          analysisPhase={analysisPhase ?? 'idle'}
          hasPropositions={hasResults}
          initialValue={textInput}
          onInitialValueConsumed={() => setTextInput('')}
          geminiLive={{ ...geminiLive, startRecording: handleVoiceStart }}
          onStopVoice={handleStopVoice}
          micBarExpanded={micBarExpanded}
          onMicBarExpand={() => setMicBarExpanded(true)}
        />
      </main>
    </div>
  );
}

export default function AnalyzePage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-50 dark:bg-[#0d0e10] flex items-center justify-center font-inter">Loading…</div>}>
      <AnalyzePageContent />
    </Suspense>
  );
}

