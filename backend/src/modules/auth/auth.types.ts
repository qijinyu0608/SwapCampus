import { UserRole } from '@prisma/client';

export type AuthenticatedUser = {
  id: number;
  supertokensUserId?: string;
  studentId: string;
  displayName?: string;
  email: string;
  role: UserRole;
  authSource?: 'supertokens' | 'dev-fallback';
};

export type RequestWithAuthenticatedUser = {
  user?: AuthenticatedUser;
};
