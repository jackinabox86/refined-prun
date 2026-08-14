import { randomUUID } from 'node:crypto';
import { mkdir, open, readFile, rename, unlink, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { assertValidStore, emptyStore, migrateStore, type MappingStoreData } from './model.ts';

export class JsonMappingStore {
  readonly path: string;
  readonly lockPath: string;

  constructor(path: string) {
    this.path = path;
    this.lockPath = `${path}.lock`;
  }

  async read() {
    let content: string;
    try {
      content = await readFile(this.path, 'utf8');
    } catch (error) {
      if (isNodeError(error) && error.code === 'ENOENT') {
        return emptyStore();
      }
      throw error;
    }
    const parsed: unknown = JSON.parse(content);
    return migrateStore(parsed);
  }

  async write(data: MappingStoreData) {
    assertValidStore(data);
    await mkdir(dirname(this.path), { recursive: true });
    const temporaryPath = `${this.path}.${process.pid}.${randomUUID()}.tmp`;
    await writeFile(temporaryPath, `${JSON.stringify(data, null, 2)}\n`, {
      encoding: 'utf8',
      flag: 'wx',
    });
    await rename(temporaryPath, this.path);
  }

  async withLock<T>(operation: () => Promise<T>) {
    await mkdir(dirname(this.path), { recursive: true });
    let handle;
    try {
      handle = await open(this.lockPath, 'wx');
      await handle.writeFile(
        `${JSON.stringify({ pid: process.pid, acquiredAt: new Date().toISOString() })}\n`,
      );
    } catch (error) {
      if (isNodeError(error) && error.code === 'EEXIST') {
        throw new Error(`Mapping store is locked by another reconcile process: ${this.lockPath}`);
      }
      throw error;
    }

    try {
      return await operation();
    } finally {
      await releaseLock(handle, this.lockPath);
    }
  }
}

async function releaseLock(handle: Awaited<ReturnType<typeof open>>, lockPath: string) {
  await handle.close();
  try {
    await unlink(lockPath);
  } catch (error) {
    if (!isNodeError(error) || error.code !== 'ENOENT') {
      throw error;
    }
  }
}

function isNodeError(value: unknown): value is NodeJS.ErrnoException {
  return value instanceof Error && 'code' in value;
}
