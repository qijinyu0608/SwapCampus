import { PrismaService } from './prisma.service';

describe('PrismaService', () => {
  afterEach(() => {
    jest.restoreAllMocks();
    delete process.env.DATABASE_URL;
  });

  it('skips connecting when DATABASE_URL is absent', async () => {
    process.env.DATABASE_URL = '';
    const service = Object.create(PrismaService.prototype) as PrismaService & {
      $connect: jest.Mock;
    };
    service.$connect = jest.fn();

    await PrismaService.prototype.onModuleInit.call(service);

    expect(service.$connect).not.toHaveBeenCalled();
  });

  it('connects to Prisma when DATABASE_URL is present', async () => {
    process.env.DATABASE_URL = 'mysql://localhost/swapcampus';
    const service = Object.create(PrismaService.prototype) as PrismaService & {
      $connect: jest.Mock;
    };
    service.$connect = jest.fn().mockResolvedValue(undefined);

    await PrismaService.prototype.onModuleInit.call(service);

    expect(service.$connect).toHaveBeenCalledTimes(1);
  });

  it('warns and continues when the Prisma connection fails', async () => {
    process.env.DATABASE_URL = 'mysql://localhost/swapcampus';
    const service = Object.create(PrismaService.prototype) as PrismaService & {
      $connect: jest.Mock;
    };
    const error = new Error('cannot connect');
    service.$connect = jest.fn().mockRejectedValue(error);
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);

    await PrismaService.prototype.onModuleInit.call(service);

    expect(warnSpy).toHaveBeenCalledWith('Prisma connection skipped:', error);
  });

  it('disconnects on module destroy', async () => {
    const service = Object.create(PrismaService.prototype) as PrismaService & {
      $disconnect: jest.Mock;
    };
    service.$disconnect = jest.fn().mockResolvedValue(undefined);

    await PrismaService.prototype.onModuleDestroy.call(service);

    expect(service.$disconnect).toHaveBeenCalledTimes(1);
  });
});
