const flushPromises = async () => {
  await new Promise<void>((resolve) => setImmediate(resolve));
};

type WorkerEntryConfig = {
  entryPath: './commerce-sync.main' | './search-indexer.main' | './governance-worker.main';
  modulePath: './commerce-sync.module' | './search-indexer.module' | './governance-worker.module';
  moduleExport: 'CommerceSyncModule' | 'SearchIndexerModule' | 'GovernanceWorkerModule';
  successMessage: string;
  loggerContext: string;
  failureMessage: string;
};

const workerEntries: WorkerEntryConfig[] = [
  {
    entryPath: './commerce-sync.main',
    modulePath: './commerce-sync.module',
    moduleExport: 'CommerceSyncModule',
    successMessage: 'commerce-sync worker started',
    loggerContext: 'CommerceSyncBootstrap',
    failureMessage: 'Failed to start commerce-sync worker:'
  },
  {
    entryPath: './search-indexer.main',
    modulePath: './search-indexer.module',
    moduleExport: 'SearchIndexerModule',
    successMessage: 'search-indexer worker started',
    loggerContext: 'SearchIndexerBootstrap',
    failureMessage: 'Failed to start search-indexer worker:'
  },
  {
    entryPath: './governance-worker.main',
    modulePath: './governance-worker.module',
    moduleExport: 'GovernanceWorkerModule',
    successMessage: 'governance-worker started',
    loggerContext: 'GovernanceWorkerBootstrap',
    failureMessage: 'Failed to start governance-worker:'
  }
];

describe('worker bootstrap entries', () => {
  afterEach(() => {
    jest.resetModules();
    jest.restoreAllMocks();
  });

  async function importWorkerEntry(config: WorkerEntryConfig, shouldFail = false) {
    const app = {
      enableShutdownHooks: jest.fn()
    };
    const error = new Error('bootstrap failed');
    const createApplicationContext = shouldFail
      ? jest.fn().mockRejectedValue(error)
      : jest.fn().mockResolvedValue(app);
    const log = jest.fn();

    jest.doMock('@nestjs/common', () => ({
      Logger: {
        log
      }
    }));
    jest.doMock('./load-env', () => ({}));
    jest.doMock('@nestjs/core', () => ({
      NestFactory: {
        createApplicationContext
      }
    }));
    jest.doMock(config.modulePath, () => ({
      [config.moduleExport]: class MockModule {}
    }));

    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const exitSpy = jest.spyOn(process, 'exit').mockImplementation((() => undefined) as any);

    await jest.isolateModulesAsync(async () => {
      await import(config.entryPath);
    });
    await flushPromises();

    return {
      app,
      error,
      createApplicationContext,
      log,
      errorSpy,
      exitSpy
    };
  }

  it.each(workerEntries)('starts %s successfully', async (config) => {
    const { app, createApplicationContext, log, exitSpy } = await importWorkerEntry(config);

    expect(createApplicationContext).toHaveBeenCalledWith(expect.any(Function), {
      logger: ['log', 'warn', 'error']
    });
    expect(app.enableShutdownHooks).toHaveBeenCalledTimes(1);
    expect(log).toHaveBeenCalledWith(config.successMessage, config.loggerContext);
    expect(exitSpy).not.toHaveBeenCalled();
  });

  it.each(workerEntries)('exits when %s bootstrap fails', async (config) => {
    const { error, errorSpy, exitSpy } = await importWorkerEntry(config, true);

    expect(errorSpy).toHaveBeenCalledWith(config.failureMessage, error);
    expect(exitSpy).toHaveBeenCalledWith(1);
  });
});
