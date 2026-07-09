import type { TarballStore } from "@/components/package/store/types";

/** R2-backed tarball storage. */
export class R2TarballStore implements TarballStore {
  constructor(private readonly bucket: R2Bucket) {}

  async put(key: string, data: Uint8Array): Promise<void> {
    await this.bucket.put(key, data);
  }

  async get(key: string): Promise<Uint8Array | null> {
    const object = await this.bucket.get(key);
    if (!object) return null;
    return new Uint8Array(await object.arrayBuffer());
  }
}
