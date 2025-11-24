/**
 * Shared test helpers
 */

import * as fs from 'fs';
import * as path from 'path';
import { execSync, ExecSyncOptions } from 'child_process';

/**
 * Find the Go implementation directory
 * Checks multiple possible locations
 */
export function findGoRepoPath(): string | null {
  const possiblePaths = [
    '/workspace/Scionic-Merkle-Tree',
    path.join(__dirname, '..', 'Scionic-Merkle-Tree'),
    path.join(process.cwd(), 'Scionic-Merkle-Tree'),
    path.join(process.cwd(), '..', 'Scionic-Merkle-Tree'),
  ];

  for (const p of possiblePaths) {
    if (fs.existsSync(p) && fs.existsSync(path.join(p, 'go.mod'))) {
      return p;
    }
  }
  return null;
}

/**
 * Check if Go implementation is available
 */
export function goImplementationAvailable(): boolean {
  return findGoRepoPath() !== null;
}

/**
 * Get the Go repo path (cached after first call)
 */
let cachedGoPath: string | null | undefined = undefined;
export function getGoRepoPath(): string | null {
  if (cachedGoPath === undefined) {
    cachedGoPath = findGoRepoPath();
  }
  return cachedGoPath;
}

/**
 * Run a Go command in the Go repo directory
 */
export function runGoCommand(args: string, timeout: number = 30000): string {
  const goPath = getGoRepoPath();
  if (!goPath) {
    throw new Error('Go repository not found');
  }

  try {
    const output = execSync(
      `cd "${goPath}" && ${args}`,
      { encoding: 'utf-8', timeout }
    );
    return output;
  } catch (error: any) {
    throw new Error(`Go command failed: ${error.message}\nOutput: ${error.stdout || error.stderr}`);
  }
}

/**
 * Execute command in Go repo directory (raw execSync wrapper)
 * Use this when you need more control over execSync options
 */
export function execInGoRepo(command: string, options?: ExecSyncOptions): Buffer | string {
  const goPath = getGoRepoPath();
  if (!goPath) {
    throw new Error('Go repository not found');
  }

  return execSync(command, {
    ...options,
    cwd: goPath,
  });
}
