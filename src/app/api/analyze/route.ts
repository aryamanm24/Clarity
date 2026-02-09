import { NextRequest, NextResponse } from 'next/server';

// This route proxies to the Python backend
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { input, session_id, engines } = body;

    if (!input || typeof input !== 'string') {
      return NextResponse.json(
        { error: 'Input is required and must be a string' },
        { status: 400 }
      );
    }

    // Call Python backend
    const pythonApiUrl = process.env.PYTHON_API_URL || 'http://localhost:8000';
    const response = await fetch(`${pythonApiUrl}/analyze`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        input,
        session_id: session_id || 'default-session',
        engines: engines || ['adversarial', 'assumption', 'precision', 'signal'],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Python API error:', errorText);
      return NextResponse.json(
        { error: `Backend error: ${response.status}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('API route error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
