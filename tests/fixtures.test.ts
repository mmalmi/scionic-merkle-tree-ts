/**
 * Test fixtures validation
 * Ensures all fixtures work correctly
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { createDag, verifyDag } from '../src/dag';
import { allFixtures } from './fixtures';

describe('Test Fixtures', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fixtures-test-'));
  });

  afterEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  test.each(allFixtures)('$name fixture creates valid DAG', async (fixture) => {
    const fixturePath = path.join(tempDir, fixture.name);
    fs.mkdirSync(fixturePath);

    fixture.setup(fixturePath);

    const dag = await createDag(fixturePath, false);
    await verifyDag(dag);

    console.log(`✓ ${fixture.name}: ${Object.keys(dag.Leafs).length} leaves`);

    expect(dag.Root).toBeDefined();
    expect(Object.keys(dag.Leafs).length).toBeGreaterThan(0);
  });

  test('all fixtures are unique', () => {
    const names = allFixtures.map((f) => f.name);
    const uniqueNames = new Set(names);

    expect(uniqueNames.size).toBe(names.length);
  });
});
