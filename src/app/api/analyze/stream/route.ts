import { NextRequest } from 'next/server';

/**
 * Proxies to Python /analyze/stream and streams the SSE response to the client.
 * Enables progressive rendering — graph appears in ~5s, analysis fills in as it completes.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { input, session_id, engines } = body;

    if (!input || typeof input !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Input is required and must be a string' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const pythonApiUrl = (process.env.PYTHON_API_URL || 'http://localhost:8000').replace(/\/$/, '');
    const urlHost = (() => {
      try {
        return new URL(pythonApiUrl).host;
      } catch {
        return null;
      }
    })();
    console.error('[analyze/stream] Backend host:', urlHost ?? 'invalid URL');
    const response = await fetch(`${pythonApiUrl}/analyze/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        input,
        session_id: session_id || `session-${Date.now()}`,
        engines: engines || ['adversarial', 'assumption', 'precision', 'signal'],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Python stream API error:', errorText);
      return new Response(
        JSON.stringify({ error: `Backend error: ${response.status}` }),
        { status: response.status, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(response.body, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('Stream API route error:', message, error);
    const isNetwork =
      /fetch failed|ECONNREFUSED|ENOTFOUND|ETIMEDOUT|Failed to fetch/i.test(
        message
      );
    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        hint: isNetwork
          ? 'Backend unreachable. Set PYTHON_API_URL to your Python API URL (e.g. on Railway).'
          : undefined,
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
