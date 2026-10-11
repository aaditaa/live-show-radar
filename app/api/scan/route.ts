import { NextResponse } from 'next/server';
import { isAuthorisedForScan } from '@/lib/auth';
import { runScan, type ScanTrigger } from '@/lib/pipeline/scan';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
// Bounded batches keep a run far below this, but the ceiling is explicit.
export const maxDuration = 300;

function resolveTrigger(request: Request): ScanTrigger {
  const url = new URL(request.url);
  const requested = url.searchParams.get('trigger');
  if (requested === 'github_actions' || requested === 'vercel_cron' || requested === 'manual') {
    return requested;
  }
  // Vercel's own cron invoker identifies itself.
  if (request.headers.get('user-agent')?.includes('vercel-cron')) return 'vercel_cron';
  return 'manual';
}

async function handle(request: Request) {
  if (!(await isAuthorisedForScan(request))) {
    return NextResponse.json({ error: 'unauthorised' }, { status: 401 });
  }

  try {
    const summary = await runScan(resolveTrigger(request));
    return NextResponse.json(summary, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'scan failed' },
      { status: 500 },
    );
  }
}

export async function GET(request: Request) {
  return handle(request);
}

export async function POST(request: Request) {
  return handle(request);
}
