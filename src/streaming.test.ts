/**
 * Tests for streaming DAG builder
 */

import { Readable } from 'stream';
import {
  StreamingDagBuilder,
  createDagFromStream,
  createDagFromBuffer,
} from './streaming';
import { LeafType } from './types';

describe('StreamingDagBuilder', () => {
  describe('addChunk', () => {
    it('should add a single chunk and return root CID', async () => {
      const builder = new StreamingDagBuilder('test.txt');
      const cid = await builder.addChunk(Buffer.from('Hello, streaming world!'));

      expect(cid).toBeTruthy();
      expect(typeof cid).toBe('string');
    });

    it('should return different CIDs as chunks are added', async () => {
      const builder = new StreamingDagBuilder('test.txt');

      const cid1 = await builder.addChunk(Buffer.from('chunk1'));
      const cid2 = await builder.addChunk(Buffer.from('chunk2'));
      const cid3 = await builder.addChunk(Buffer.from('chunk3'));

      expect(cid1).not.toBe(cid2);
      expect(cid2).not.toBe(cid3);
    });

    it('should throw error on empty chunk', async () => {
      const builder = new StreamingDagBuilder('test.txt');
      await expect(builder.addChunk(Buffer.alloc(0))).rejects.toThrow('Empty chunk');
    });
  });

  describe('finalize', () => {
    it('should create a complete DAG with all chunks', async () => {
      const builder = new StreamingDagBuilder('test.txt');

      await builder.addChunk(Buffer.from('chunk1'));
      await builder.addChunk(Buffer.from('chunk2'));
      await builder.addChunk(Buffer.from('chunk3'));

      const dag = await builder.finalize();

      expect(dag.Root).toBeTruthy();
      expect(Object.keys(dag.Leafs).length).toBe(4); // 3 chunks + 1 parent

      const rootLeaf = dag.Leafs[dag.Root];
      expect(rootLeaf.Type).toBe(LeafType.File);
      expect(rootLeaf.ItemName).toBe('test.txt');
      expect(rootLeaf.Links?.length).toBe(3);
    });

    it('should throw error when no chunks added', async () => {
      const builder = new StreamingDagBuilder('test.txt');
      await expect(builder.finalize()).rejects.toThrow('No chunks to finalize');
    });
  });

  describe('streamFromBuffer', () => {
    it('should stream a small buffer', async () => {
      const data = Buffer.from('Hello, streaming world!');
      const builder = new StreamingDagBuilder('test.txt');

      const cids: string[] = [];
      const dag = await builder.streamFromBuffer(data, (cid) => {
        cids.push(cid);
      });

      expect(dag.Root).toBeTruthy();
      expect(cids.length).toBe(1); // Small buffer = 1 chunk = 1 callback
    });

    it('should stream a large buffer with multiple chunks', async () => {
      // Create 5MB of data (2.5 chunks at 2MB each)
      const size = 5 * 1024 * 1024;
      const data = Buffer.alloc(size);
      for (let i = 0; i < size; i++) {
        data[i] = i % 256;
      }

      const builder = new StreamingDagBuilder('large.bin');

      const cids: string[] = [];
      const dag = await builder.streamFromBuffer(data, (cid) => {
        cids.push(cid);
      });

      expect(dag.Root).toBeTruthy();
      expect(cids.length).toBe(3); // 5MB = 3 chunks (2MB + 2MB + 1MB)

      // Verify all CIDs changed as chunks were added
      expect(cids[0]).not.toBe(cids[1]);
      expect(cids[1]).not.toBe(cids[2]);

      // Verify DAG structure
      const rootLeaf = dag.Leafs[dag.Root];
      expect(rootLeaf.Links?.length).toBe(3);
      expect(rootLeaf.LeafCount).toBe(4); // 3 chunks + 1 root
      expect(rootLeaf.ContentSize).toBe(size);
    });

    it('should use custom chunk size', async () => {
      const data = Buffer.alloc(1024 * 1024); // 1MB
      const builder = new StreamingDagBuilder('test.bin')
        .withChunkSize(256 * 1024); // 256KB chunks

      const cids: string[] = [];
      const dag = await builder.streamFromBuffer(data, (cid) => {
        cids.push(cid);
      });

      expect(cids.length).toBe(4); // 1MB / 256KB = 4 chunks
    });
  });

  describe('streamFromReadable', () => {
    it('should stream from a readable stream', async () => {
      const data = Buffer.from('Hello, streaming world!');
      const readable = Readable.from([data]);

      const builder = new StreamingDagBuilder('test.txt');

      const cids: string[] = [];
      const dag = await builder.streamFromReadable(readable, (cid) => {
        cids.push(cid);
      });

      expect(dag.Root).toBeTruthy();
      expect(cids.length).toBeGreaterThan(0);
    });

    it('should stream a large stream with multiple chunks', async () => {
      // Create 5MB of data
      const size = 5 * 1024 * 1024;
      const data = Buffer.alloc(size);
      for (let i = 0; i < size; i++) {
        data[i] = i % 256;
      }

      // Create readable stream - simpler approach
      const readable = Readable.from(async function* () {
        const chunkSize = 64 * 1024; // Emit 64KB at a time
        let offset = 0;

        while (offset < size) {
          const end = Math.min(offset + chunkSize, size);
          yield data.slice(offset, end);
          offset = end;
        }
      }());

      const builder = new StreamingDagBuilder('large.bin');

      const cids: string[] = [];
      const dag = await builder.streamFromReadable(readable, (cid) => {
        cids.push(cid);
      });

      expect(dag.Root).toBeTruthy();
      expect(cids.length).toBe(3); // 5MB = 3 chunks
    }, 30000);

    it('should handle stream errors', async () => {
      const readable = new Readable({
        read() {
          this.destroy(new Error('Stream error'));
        }
      });

      const builder = new StreamingDagBuilder('test.txt');

      await expect(
        builder.streamFromReadable(readable, () => {})
      ).rejects.toThrow('Stream error');
    });
  });

  describe('createDagFromBuffer', () => {
    it('should create DAG from buffer with callback', async () => {
      const data = Buffer.from('Hello, streaming world!');

      const cids: string[] = [];
      const dag = await createDagFromBuffer(data, 'test.txt', (cid) => {
        cids.push(cid);
      });

      expect(dag.Root).toBeTruthy();
      expect(cids.length).toBe(1);
    });
  });

  describe('createDagFromStream', () => {
    it('should create DAG from stream with callback', async () => {
      const data = Buffer.from('Hello, streaming world!');
      const readable = Readable.from([data]);

      const cids: string[] = [];
      const dag = await createDagFromStream(readable, 'test.txt', (cid) => {
        cids.push(cid);
      });

      expect(dag.Root).toBeTruthy();
      expect(cids.length).toBeGreaterThan(0);
    });
  });

  describe('incremental CID updates', () => {
    it('should provide updated root CID after each chunk', async () => {
      const builder = new StreamingDagBuilder('test.txt');

      const cid1 = await builder.addChunk(Buffer.from('chunk1'));
      const cid2 = await builder.addChunk(Buffer.from('chunk2'));
      const cid3 = await builder.addChunk(Buffer.from('chunk3'));

      // Each addition should produce different root CID
      expect(cid1).not.toBe(cid2);
      expect(cid2).not.toBe(cid3);

      const dag = await builder.finalize();

      // Final root CID will be different from intermediate CIDs
      // because finalize() adds statistics (LeafCount, ContentSize, DagSize)
      expect(dag.Root).not.toBe(cid3);
      expect(dag.Root).toBeTruthy();

      // Verify the DAG was created correctly
      expect(Object.keys(dag.Leafs).length).toBe(4); // 3 chunks + 1 parent
    });
  });

  describe('chunk naming', () => {
    it('should name chunks with correct pattern', async () => {
      const builder = new StreamingDagBuilder('test.txt');

      await builder.addChunk(Buffer.from('chunk1'));
      await builder.addChunk(Buffer.from('chunk2'));

      const dag = await builder.finalize();

      const chunks = Object.values(dag.Leafs).filter(
        leaf => leaf.Type === LeafType.Chunk
      );

      expect(chunks.length).toBe(2);
      expect(chunks[0].ItemName).toBe('test.txt/0');
      expect(chunks[1].ItemName).toBe('test.txt/1');
    });
  });
});
