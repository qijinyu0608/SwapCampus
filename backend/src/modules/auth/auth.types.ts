import { UserRole } from '@prisma/client';

export type AuthenticatedUser = {
  id: number;
  supertokensUserId?: string;
  studentId?: string | null;
  displayName?: string;
  email: string;
  avatarUrl?: string | null;
  avatarFrame?: string | null;
  avatarFrameUnlocked?: boolean;
  role: UserRole;
  authSource?: 'supertokens' | 'dev-fallback';
};

export type RequestWithAuthenticatedUser = {
  user?: AuthenticatedUser;
};
