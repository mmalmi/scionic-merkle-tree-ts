/**
 * Streaming DAG builder for large files
 * Allows incremental chunk processing with progress callbacks
 */

import { Readable } from 'stream';
import { DagLeafBuilder } from './leaf';
import { Dag, DagLeaf, LeafType, ScionicError, DEFAULT_CHUNK_SIZE } from './types';

/**
 * Streaming DAG builder for processing large files in chunks
 * Provides intermediate root CIDs after each chunk is added
 */
export class StreamingDagBuilder {
  private fileName: string;
  private chunkSize: number;
  private chunks: DagLeaf[] = [];
  private chunkCount: number = 0;

  constructor(fileName: string) {
    this.fileName = fileName;
    this.chunkSize = DEFAULT_CHUNK_SIZE;
  }

  /**
   * Set custom chunk size
   */
  withChunkSize(size: number): this {
    this.chunkSize = size;
    return this;
  }

  /**
   * Process a chunk of data and return the current root CID
   * This allows tracking progress as chunks are added
   */
  async addChunk(data: Uint8Array): Promise<string> {
    if (data.length === 0) {
      throw new ScionicError('Empty chunk');
    }

    // Create chunk leaf
    const chunkName = `${this.fileName}/${this.chunkCount}`;
    const chunkLeaf = await new DagLeafBuilder(chunkName)
      .setType(LeafType.Chunk)
      .setData(data)
      .buildLeaf();

    this.chunks.push(chunkLeaf);
    this.chunkCount++;

    // Build current root
    return await this.buildCurrentRoot();
  }

  /**
   * Build the current root CID with all chunks so far
   */
  private async buildCurrentRoot(): Promise<string> {
    if (this.chunks.length === 0) {
      throw new ScionicError('No chunks yet');
    }

    // Build parent file leaf
    let leafBuilder = new DagLeafBuilder(this.fileName)
      .setType(LeafType.File);

    for (const chunk of this.chunks) {
      leafBuilder = leafBuilder.addLink(chunk.Hash);
    }

    const parent = await leafBuilder.buildLeaf();
    return parent.Hash;
  }

  /**
   * Finalize and return the complete DAG
   */
  async finalize(): Promise<Dag> {
    if (this.chunks.length === 0) {
      throw new ScionicError('No chunks to finalize');
    }

    const leaves: Record<string, DagLeaf> = {};

    // Add all chunk leaves
    for (const chunk of this.chunks) {
      leaves[chunk.Hash] = chunk;
    }

    // Build root file leaf
    let rootBuilder = new DagLeafBuilder(this.fileName)
      .setType(LeafType.File);

    for (const chunk of this.chunks) {
      rootBuilder = rootBuilder.addLink(chunk.Hash);
    }

    // Calculate statistics
    const leafCount = this.chunks.length + 1; // chunks + root
    let contentSize = 0;
    let childrenDagSize = 0;

    // Calculate content size and children DAG size
    for (const chunk of this.chunks) {
      if (chunk.Content) {
        contentSize += chunk.Content.length;
      }

      // Calculate CBOR size for each chunk
      const cbor = require('cbor');
      const sortedLinks = chunk.Links ? [...chunk.Links].sort() : [];
      const sortedAdditionalData = chunk.AdditionalData && Object.keys(chunk.AdditionalData).length > 0
        ? Object.entries(chunk.AdditionalData).sort((a, b) => a[0].localeCompare(b[0])).reduce((acc, [k, v]) => { acc[k] = v; return acc; }, {} as Record<string, string>)
        : {};

      const leafForSize = {
        Hash: chunk.Hash,
        ItemName: chunk.ItemName,
        Type: chunk.Type,
        ContentHash: chunk.ContentHash ? Buffer.from(chunk.ContentHash) : null,
        Content: chunk.Content ? Buffer.from(chunk.Content) : null,
        ClassicMerkleRoot: chunk.ClassicMerkleRoot ? Buffer.from(chunk.ClassicMerkleRoot) : Buffer.alloc(0),
        CurrentLinkCount: chunk.CurrentLinkCount,
        LeafCount: chunk.LeafCount || 0,
        ContentSize: chunk.ContentSize || 0,
        DagSize: chunk.DagSize || 0,
        Links: sortedLinks,
        AdditionalData: sortedAdditionalData,
      };
      childrenDagSize += cbor.encode(leafForSize).length;
    }

    // Build temp root to calculate its size
    const tempRoot = await rootBuilder.buildRootLeaf(
      undefined,
      leafCount,
      contentSize,
      0 // temporary DagSize
    );

    // Calculate root CBOR size
    const cbor = require('cbor');
    const sortedAdditionalData = tempRoot.AdditionalData && Object.keys(tempRoot.AdditionalData).length > 0
      ? Object.entries(tempRoot.AdditionalData).sort((a, b) => a[0].localeCompare(b[0])).map(([k, v]) => ({ Key: k, Value: v }))
      : [];

    const tempRootForSize = {
      ItemName: tempRoot.ItemName,
      Type: tempRoot.Type,
      MerkleRoot: tempRoot.ClassicMerkleRoot ? Buffer.from(tempRoot.ClassicMerkleRoot) : Buffer.alloc(0),
      CurrentLinkCount: tempRoot.CurrentLinkCount,
      LeafCount: tempRoot.LeafCount,
      ContentSize: tempRoot.ContentSize,
      DagSize: 0,
      ContentHash: tempRoot.ContentHash ? Buffer.from(tempRoot.ContentHash) : null,
      AdditionalData: sortedAdditionalData,
    };
    const rootLeafSize = cbor.encode(tempRootForSize).length;

    // Final DagSize
    const dagSize = childrenDagSize + rootLeafSize;

    // Create final root with correct DagSize
    const root = await rootBuilder.buildRootLeaf(
      undefined,
      leafCount,
      contentSize,
      dagSize
    );
    const rootHash = root.Hash;

    leaves[rootHash] = root;

    return {
      Root: rootHash,
      Leafs: leaves,
    };
  }

  /**
   * Stream from a readable stream, calling callback with CID after each chunk
   */
  async streamFromReadable(
    readable: Readable,
    callback: (cid: string) => void
  ): Promise<Dag> {
    return new Promise((resolve, reject) => {
      const buffer: Buffer[] = [];
      let bufferSize = 0;

      readable.on('data', async (chunk: Buffer) => {
        buffer.push(chunk);
        bufferSize += chunk.length;

        // Process full chunks
        while (bufferSize >= this.chunkSize) {
          const chunkData = Buffer.concat(buffer);
          const toProcess = chunkData.slice(0, this.chunkSize);
          const remaining = chunkData.slice(this.chunkSize);

          // Clear buffer and add remaining
          buffer.length = 0;
          if (remaining.length > 0) {
            buffer.push(remaining);
          }
          bufferSize = remaining.length;

          try {
            const cid = await this.addChunk(toProcess);
            callback(cid);
          } catch (err) {
            readable.destroy();
            reject(err);
            return;
          }
        }
      });

      readable.on('end', async () => {
        try {
          // Process remaining data as final chunk
          if (bufferSize > 0) {
            const finalChunk = Buffer.concat(buffer);
            const cid = await this.addChunk(finalChunk);
            callback(cid);
          }

          const dag = await this.finalize();
          resolve(dag);
        } catch (err) {
          reject(err);
        }
      });

      readable.on('error', (err) => {
        reject(err);
      });
    });
  }

  /**
   * Stream from a buffer (useful for testing)
   */
  async streamFromBuffer(
    buffer: Buffer,
    callback: (cid: string) => void
  ): Promise<Dag> {
    let offset = 0;

    while (offset < buffer.length) {
      const chunkSize = Math.min(this.chunkSize, buffer.length - offset);
      const chunk = buffer.slice(offset, offset + chunkSize);

      const cid = await this.addChunk(chunk);
      callback(cid);

      offset += chunkSize;
    }

    return await this.finalize();
  }
}

/**
 * Create a streaming DAG from a readable stream
 */
export async function createDagFromStream(
  readable: Readable,
  fileName: string,
  callback: (cid: string) => void
): Promise<Dag> {
  const builder = new StreamingDagBuilder(fileName);
  return await builder.streamFromReadable(readable, callback);
}

/**
 * Create a streaming DAG from a buffer
 */
export async function createDagFromBuffer(
  buffer: Buffer,
  fileName: string,
  callback: (cid: string) => void
): Promise<Dag> {
  const builder = new StreamingDagBuilder(fileName);
  return await builder.streamFromBuffer(buffer, callback);
}
