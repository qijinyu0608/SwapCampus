export const GOVERNANCE_EXCHANGE = 'swapcampus.governance';
export const GOVERNANCE_ROUTING_KEY = 'governance.audit';
export const GOVERNANCE_QUEUE = 'swapcampus.governance.audit';

function toPositiveInt(value: string | undefined, fallback: number) {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export type GovernanceRabbitmqConfig = {
  enabled: boolean;
  url: string;
  exchange: string;
  queue: string;
  routingKey: string;
  prefetchCount: number;
};

export function getGovernanceRabbitmqConfig(env: NodeJS.ProcessEnv = process.env): GovernanceRabbitmqConfig {
  return {
    enabled: env.GOVERNANCE_MQ_ENABLED === 'true',
    url: env.RABBITMQ_URL ?? 'amqp://guest:guest@rabbitmq:5672',
    exchange: env.GOVERNANCE_MQ_EXCHANGE ?? GOVERNANCE_EXCHANGE,
    queue: env.GOVERNANCE_MQ_QUEUE ?? GOVERNANCE_QUEUE,
    routingKey: env.GOVERNANCE_MQ_ROUTING_KEY ?? GOVERNANCE_ROUTING_KEY,
    prefetchCount: toPositiveInt(env.GOVERNANCE_MQ_PREFETCH, 20)
  };
}

