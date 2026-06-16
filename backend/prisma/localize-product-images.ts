import '../src/load-env';
import { spawn } from 'node:child_process';

async function main() {
  await new Promise<void>((resolve, reject) => {
    const child = spawn('tsx', ['prisma/download-remote-product-images.ts'], {
      cwd: process.cwd(),
      stdio: 'inherit',
      shell: true
    });

    child.on('exit', (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`download-remote-product-images exited with code ${code ?? 'unknown'}`));
    });
    child.on('error', reject);
  });
}

main()
  .catch((error) => {
    console.error('[db:localize-product-images] failed', error);
    process.exitCode = 1;
  });
