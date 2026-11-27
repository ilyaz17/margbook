import { NextRequest } from 'next/server';
import { DecodedIdToken } from 'firebase-admin/auth';
import { adminAuth } from './firebase-admin.ts';
import { getOrCreateUser } from '../db/users.ts';

export interface VerifiedSession {
  decoded: DecodedIdToken;
  user: {
    id: number;
    uid: string;
    email: string;
    displayName: string;
    role: string;
  };
}

export async function verifyRequestAuth(
  req: NextRequest
): Promise<VerifiedSession | null> {
  const authHeader = req.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.slice(7).trim();
  if (!token) {
    return null;
  }

  try {
    const decoded = await adminAuth.verifyIdToken(token);
    const email = decoded.email || `${decoded.uid}@margbooks.local`;
    const user = await getOrCreateUser(decoded.uid, email, decoded.name);
    return { decoded, user };
  } catch (error) {
    console.error('Firebase token verification failed:', error);
    return null;
  }
}
