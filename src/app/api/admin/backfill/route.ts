import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const GH_REPO = process.env.GITHUB_REPO; // 例 "yuhan/AvBatch"
const GH_TOKEN = process.env.GITHUB_TOKEN; // PAT with actions:write
const WORKFLOW = 'backfill.yml';

function envError() {
  if (!GH_REPO || !GH_TOKEN) {
    return NextResponse.json(
      { success: false, error: '伺服器未設置 GITHUB_REPO / GITHUB_TOKEN' },
      { status: 500 }
    );
  }
  return null;
}

const ghHeaders = () => ({
  Accept: 'application/vnd.github+json',
  Authorization: `Bearer ${GH_TOKEN}`,
  'X-GitHub-Api-Version': '2022-11-28',
});

export async function GET() {
  const err = envError();
  if (err) return err;

  try {
    const res = await fetch(
      `https://api.github.com/repos/${GH_REPO}/actions/workflows/${WORKFLOW}/runs?per_page=1`,
      { headers: ghHeaders(), cache: 'no-store' }
    );
    if (!res.ok) {
      const body = await res.text();
      return NextResponse.json({ success: false, error: `GitHub API ${res.status}: ${body}` }, { status: 502 });
    }
    const data = await res.json();
    const run = data.workflow_runs?.[0];
    return NextResponse.json({
      success: true,
      workflowUrl: `https://github.com/${GH_REPO}/actions/workflows/${WORKFLOW}`,
      latestRun: run
        ? {
            id: run.id,
            status: run.status,
            conclusion: run.conclusion,
            createdAt: run.created_at,
            url: run.html_url,
          }
        : null,
    });
  } catch (e) {
    return NextResponse.json({ success: false, error: String(e) }, { status: 500 });
  }
}

export async function POST() {
  const err = envError();
  if (err) return err;

  try {
    const res = await fetch(
      `https://api.github.com/repos/${GH_REPO}/actions/workflows/${WORKFLOW}/dispatches`,
      {
        method: 'POST',
        headers: { ...ghHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ ref: 'main', inputs: { limit: '1000' } }),
      }
    );
    if (!res.ok) {
      const body = await res.text();
      return NextResponse.json({ success: false, error: `GitHub API ${res.status}: ${body}` }, { status: 502 });
    }
    return NextResponse.json({
      success: true,
      dispatchedAt: new Date().toISOString(),
      workflowUrl: `https://github.com/${GH_REPO}/actions/workflows/${WORKFLOW}`,
    });
  } catch (e) {
    return NextResponse.json({ success: false, error: String(e) }, { status: 500 });
  }
}
