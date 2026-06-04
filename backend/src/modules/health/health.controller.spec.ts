import { HealthController } from './health.controller';

describe('HealthController', () => {
  it('should return service status', () => {
    const controller = new HealthController();
    const result = controller.getHealth();

    expect(result.status).toBe('ok');
    expect(result.service).toBe('swapcampus-backend');
  });
});
