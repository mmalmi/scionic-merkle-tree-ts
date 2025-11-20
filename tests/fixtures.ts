/**
 * Test fixtures for comprehensive testing
 * Mirrors the testutil package from Go implementation
 */

import * as fs from 'fs';
import * as path from 'path';

export interface TestFixture {
  name: string;
  setup: (basePath: string) => void;
  description: string;
}

/**
 * Single small file fixture
 */
export const singleSmallFile: TestFixture = {
  name: 'SingleSmallFile',
  description: 'A single file under chunk size',
  setup: (basePath: string) => {
    fs.writeFileSync(path.join(basePath, 'small.txt'), 'Small file content');
  },
};

/**
 * Single large file fixture
 */
export const singleLargeFile: TestFixture = {
  name: 'SingleLargeFile',
  description: 'A single file requiring chunking',
  setup: (basePath: string) => {
    const CHUNK_SIZE = 2 * 1024 * 1024;
    const content = Buffer.alloc(CHUNK_SIZE + 1000, 'L');
    fs.writeFileSync(path.join(basePath, 'large.bin'), content);
  },
};

/**
 * Flat directory fixture
 */
export const flatDirectory: TestFixture = {
  name: 'FlatDirectory',
  description: 'Multiple files in a single directory',
  setup: (basePath: string) => {
    for (let i = 0; i < 5; i++) {
      fs.writeFileSync(path.join(basePath, `file${i}.txt`), `Content ${i}`);
    }
  },
};

/**
 * Nested directory fixture
 */
export const nestedDirectory: TestFixture = {
  name: 'NestedDirectory',
  description: 'Directories with subdirectories',
  setup: (basePath: string) => {
    fs.writeFileSync(path.join(basePath, 'root.txt'), 'Root content');

    const sub1 = path.join(basePath, 'subdir1');
    fs.mkdirSync(sub1);
    fs.writeFileSync(path.join(sub1, 'sub1.txt'), 'Sub1 content');

    const sub2 = path.join(basePath, 'subdir2');
    fs.mkdirSync(sub2);
    fs.writeFileSync(path.join(sub2, 'sub2.txt'), 'Sub2 content');
  },
};

/**
 * Deep hierarchy fixture
 */
export const deepHierarchy: TestFixture = {
  name: 'DeepHierarchy',
  description: 'Deep nested directory structure',
  setup: (basePath: string) => {
    let currentDir = basePath;
    for (let i = 0; i < 10; i++) {
      currentDir = path.join(currentDir, `level${i}`);
      fs.mkdirSync(currentDir);
      fs.writeFileSync(path.join(currentDir, `file${i}.txt`), `Level ${i} content`);
    }
  },
};

/**
 * Mixed sizes fixture
 */
export const mixedSizes: TestFixture = {
  name: 'MixedSizes',
  description: 'Mix of small and large files',
  setup: (basePath: string) => {
    // Small files
    fs.writeFileSync(path.join(basePath, 'tiny.txt'), 'a');
    fs.writeFileSync(path.join(basePath, 'small.txt'), 'Small content here');

    // Medium file
    const mediumContent = Buffer.alloc(100 * 1024, 'M'); // 100KB
    fs.writeFileSync(path.join(basePath, 'medium.bin'), mediumContent);

    // Large file
    const CHUNK_SIZE = 2 * 1024 * 1024;
    const largeContent = Buffer.alloc(CHUNK_SIZE + 500, 'L');
    fs.writeFileSync(path.join(basePath, 'large.bin'), largeContent);
  },
};

/**
 * Empty directory fixture
 */
export const emptyDirectory: TestFixture = {
  name: 'EmptyDirectory',
  description: 'Empty directory with no files',
  setup: (basePath: string) => {
    // Directory is already created by test, just don't add files
  },
};

/**
 * All available fixtures
 */
export const allFixtures: TestFixture[] = [
  singleSmallFile,
  singleLargeFile,
  flatDirectory,
  nestedDirectory,
  deepHierarchy,
  mixedSizes,
  emptyDirectory,
];

/**
 * Multi-file fixtures (useful for partial DAG tests)
 */
export const multiFileFixtures: TestFixture[] = [
  flatDirectory,
  nestedDirectory,
  deepHierarchy,
  mixedSizes,
];
