import { NextRequest, NextResponse } from 'next/server';
import { verifyRequestAuth } from '../../../src/lib/auth-server.ts';
import { loadWorkspaceForUser } from '../../../src/db/workspace-repo.ts';

export async function GET(req: NextRequest) {
  const session = await verifyRequestAuth(req);
  if (!session) {
    return NextResponse.json(
      { error: 'Unauthorized: Sign in with Google to access workspace data.' },
      { status: 401 }
    );
  }

  try {
    const companyParam = req.nextUrl.searchParams.get('companyId');
    const requestedCompanyId = companyParam ? Number(companyParam) : undefined;
    const data = await loadWorkspaceForUser(
      session.user.uid,
      Number.isFinite(requestedCompanyId) ? requestedCompanyId : undefined
    );
    return NextResponse.json(data);
  } catch (error) {
    console.error('GET /api/workspace failed:', error);
    return NextResponse.json(
      { error: 'Failed to load workspace data. Please try again.' },
      { status: 500 }
    );
  }
}
