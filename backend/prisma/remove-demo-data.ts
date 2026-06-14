import { PrismaClient } from '@prisma/client';
import SuperTokens, { deleteUser as deleteSuperTokensUser } from 'supertokens-node';
import { getSuperTokensConfig } from '../src/modules/auth/supertokens.config';

const prisma = new PrismaClient();
const PRODUCT_INDEX_UID = 'products';

let superTokensInitialized = false;

function ensureSuperTokensInit() {
  if (superTokensInitialized) {
    return;
  }

  SuperTokens.init(getSuperTokensConfig());
  superTokensInitialized = true;
}

async function deleteSuperTokensAccounts(userIds: string[]) {
  const remoteIds = [...new Set(userIds.filter((userId) => userId && !userId.startsWith('local-')))];
  if (!remoteIds.length) {
    return;
  }

  ensureSuperTokensInit();

  for (const userId of remoteIds) {
    try {
      await deleteSuperTokensUser(userId, true);
      console.log(`[db:remove-demo-data] deleted SuperTokens user ${userId}`);
    } catch (error) {
      console.warn(`[db:remove-demo-data] skip SuperTokens user ${userId}:`, error);
    }
  }
}

export async function clearProductSearchIndex() {
  const host = process.env.MEILISEARCH_HOST?.trim();
  if (!host) {
    console.warn('[db:remove-demo-data] skip Meilisearch cleanup: MEILISEARCH_HOST is not set');
    return;
  }

  const headers: Record<string, string> = {};
  const apiKey = process.env.MEILISEARCH_API_KEY?.trim();
  if (apiKey) {
    headers.Authorization = `Bearer ${apiKey}`;
  }

  const response = await fetch(`${host}/indexes/${PRODUCT_INDEX_UID}/documents`, {
    method: 'DELETE',
    headers
  });

  if (response.status === 404) {
    console.log('[db:remove-demo-data] Meilisearch products index not found, skip cleanup');
    return;
  }

  if (!response.ok) {
    throw new Error(`[db:remove-demo-data] failed to clear Meilisearch index: ${response.status} ${response.statusText}`);
  }

  const task = (await response.json()) as { taskUid?: number; uid?: number };
  const taskUid = task.taskUid ?? task.uid;

  if (typeof taskUid === 'number') {
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const taskResponse = await fetch(`${host}/tasks/${taskUid}`, {
        headers
      });

      if (!taskResponse.ok) {
        throw new Error(`[db:remove-demo-data] failed to poll Meilisearch task ${taskUid}: ${taskResponse.status} ${taskResponse.statusText}`);
      }

      const taskBody = (await taskResponse.json()) as { status?: string };
      if (taskBody.status === 'succeeded') {
        console.log('[db:remove-demo-data] cleared Meilisearch product documents');
        return;
      }

      if (taskBody.status === 'failed') {
        throw new Error(`[db:remove-demo-data] Meilisearch task ${taskUid} failed`);
      }

      await new Promise((resolve) => setTimeout(resolve, 300));
    }

    throw new Error(`[db:remove-demo-data] Meilisearch task ${taskUid} did not finish in time`);
  }

  console.log('[db:remove-demo-data] cleared Meilisearch product documents');
}

async function main() {
  const userIds = await prisma.user.findMany({
    select: {
      supertokensUserId: true
    }
  });

  await deleteSuperTokensAccounts(
    userIds.flatMap((item) => (item.supertokensUserId ? [item.supertokensUserId] : []))
  );

  await prisma.report.deleteMany();
  await prisma.message.deleteMany();
  await prisma.conversation.deleteMany();
  await prisma.review.deleteMany();
  await prisma.order.deleteMany();
  await prisma.campusServiceOrder.deleteMany();
  await prisma.campusServiceFavorite.deleteMany();
  await prisma.campusServiceBehavior.deleteMany();
  await prisma.campusServiceImage.deleteMany();
  await prisma.campusServiceListing.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.favorite.deleteMany();
  await prisma.userFollow.deleteMany();
  await prisma.userBehavior.deleteMany();
  await prisma.productImage.deleteMany();
  await prisma.product.deleteMany();
  await prisma.creditRedeemOrder.deleteMany();
  await prisma.creditMissionClaim.deleteMany();
  await prisma.creditPointLedger.deleteMany();
  await prisma.userCreditAsset.deleteMany();
  await prisma.studentVerification.deleteMany();
  await prisma.user.deleteMany();
  await clearProductSearchIndex();

  console.log('[db:remove-demo-data] removed all current user/product/campus-service demo data');
}

main()
  .catch((error) => {
    console.error('[db:remove-demo-data] failed', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
