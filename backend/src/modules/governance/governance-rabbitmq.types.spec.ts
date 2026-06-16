import {
  getGovernanceRabbitmqConfig,
  GOVERNANCE_EXCHANGE,
  GOVERNANCE_QUEUE,
  GOVERNANCE_ROUTING_KEY
} from './governance-rabbitmq.types';

describe('governance rabbitmq config', () => {
  it('should use defaults when env is missing', () => {
    const config = getGovernanceRabbitmqConfig({} as NodeJS.ProcessEnv);

    expect(config).toEqual({
      enabled: false,
      url: 'amqp://guest:guest@rabbitmq:5672',
      exchange: GOVERNANCE_EXCHANGE,
      queue: GOVERNANCE_QUEUE,
      routingKey: GOVERNANCE_ROUTING_KEY,
      prefetchCount: 20
    });
  });

  it('should parse custom governance mq env', () => {
    const config = getGovernanceRabbitmqConfig({
      GOVERNANCE_MQ_ENABLED: 'true',
      RABBITMQ_URL: 'amqp://mq:5672',
      GOVERNANCE_MQ_EXCHANGE: 'governance.events',
      GOVERNANCE_MQ_QUEUE: 'governance.audit.queue',
      GOVERNANCE_MQ_ROUTING_KEY: 'governance.audit.created',
      GOVERNANCE_MQ_PREFETCH: '8'
    } as NodeJS.ProcessEnv);

    expect(config).toEqual({
      enabled: true,
      url: 'amqp://mq:5672',
      exchange: 'governance.events',
      queue: 'governance.audit.queue',
      routingKey: 'governance.audit.created',
      prefetchCount: 8
    });
  });
});

