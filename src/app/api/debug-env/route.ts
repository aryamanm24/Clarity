import { NextResponse } from 'next/server';

/**
 * Temporary debug endpoint to verify PYTHON_API_URL is visible at runtime.
 * Open: https://your-frontend.up.railway.app/api/debug-env
 * Remove this file once deployment is confirmed working.
 */
export async function GET() {
  const raw = process.env.PYTHON_API_URL;
  let host: string | null = null;
  if (raw) {
    try {
      host = new URL(raw.replace(/\/$/, '')).host;
    } catch {
      host = null;
    }
  }
  return NextResponse.json({
    PYTHON_API_URL_set: !!raw,
    PYTHON_API_URL_host: host,
    hint: !raw
      ? 'Add PYTHON_API_URL on the frontend service (e.g. https://your-backend.up.railway.app), then redeploy.'
      : null,
  });
}
