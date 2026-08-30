import crypto from 'node:crypto';
import { cleanText, cleanTitle } from './image.js';

const CLAIM_STALE_MS = 2 * 60 * 1000;
const WAIT_ATTEMPTS = 24;
const WAIT_MS = 250;

const pause = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
const conflict = (error) => error && (error.statusCode === '409' || error.status === 409 || /already exists|duplicate/i.test(error.message));
const notFound = (error) => error && (error.statusCode === '404' || error.status === 404 || /not found|does not exist/i.test(error.message));

export function objectPaths(userId, hash, extension = 'jpg') {
  const root = `users/${userId}`;
  return {
    image: `${root}/images/${hash}.${extension}`,
    metadata: `${root}/meta/${hash}.json`,
    claim: `${root}/claims/${hash}.json`,
  };
}

async function blobJson(blob) {
  try { return JSON.parse(await blob.text()); }
  catch { return null; }
}

export class GalleryStore {
  constructor({ supabase, bucket, signedUrlTtl = 300 }) {
    this.supabase = supabase;
    this.bucket = bucket;
    this.signedUrlTtl = signedUrlTtl;
  }

  storage() {
    return this.supabase.storage.from(this.bucket);
  }

  async ensurePrivateBucket() {
    const { data, error } = await this.supabase.storage.getBucket(this.bucket);
    const options = {
      public: false,
      fileSizeLimit: 10 * 1024 * 1024,
      allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'application/json'],
    };
    if (data) {
      const { error: updateError } = await this.supabase.storage.updateBucket(this.bucket, options);
      if (updateError) throw updateError;
      return;
    }
    if (error && !notFound(error)) throw error;
    const { error: createError } = await this.supabase.storage.createBucket(this.bucket, options);
    if (createError && !conflict(createError)) throw createError;
  }

  async get(userId, id) {
    if (!/^[a-f0-9]{64}$/.test(String(id || ''))) return null;
    const path = objectPaths(userId, id).metadata;
    const { data, error } = await this.storage().download(path);
    if (error) {
      if (notFound(error)) return null;
      throw error;
    }
    return blobJson(data);
  }

  async signedItem(item) {
    const { data, error } = await this.storage().createSignedUrl(item.storage_path, this.signedUrlTtl);
    if (error) throw error;
    return {
      id: item.id,
      media_type: item.media_type,
      width: item.width,
      height: item.height,
      title: item.title,
      first_description: item.first_description,
      first_impression: item.first_impression,
      first_sent_at: item.first_sent_at,
      send_count: item.send_count || 0,
      created_at: item.created_at,
      signed_url: data.signedUrl,
      signed_url_expires_in: this.signedUrlTtl,
    };
  }

  async list(userId) {
    const { data: files, error } = await this.storage().list(`users/${userId}/meta`, {
      limit: 1000,
      sortBy: { column: 'created_at', order: 'desc' },
    });
    if (error) throw error;
    const items = await Promise.all((files || [])
      .filter((file) => /^[a-f0-9]{64}\.json$/.test(file.name))
      .map((file) => this.get(userId, file.name.slice(0, -5))));
    const ordered = items.filter(Boolean).sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
    const signed = await Promise.allSettled(ordered.map((item) => this.signedItem(item)));
    signed.filter((result) => result.status === 'rejected').forEach((result) => {
      console.error('[gallery] item signing failed', result.reason?.message || 'unknown');
    });
    return signed.filter((result) => result.status === 'fulfilled').map((result) => result.value);
  }

  async tryClaim(userId, hash, operation) {
    const path = objectPaths(userId, hash).claim;
    const claim = {
      operation_id: crypto.randomUUID(),
      operation,
      created_at: new Date().toISOString(),
    };
    const attempt = async () => this.storage().upload(path, Buffer.from(JSON.stringify(claim)), {
      contentType: 'application/json',
      cacheControl: '0',
      upsert: false,
    });
    let result = await attempt();
    if (!result.error) return claim;
    if (!conflict(result.error)) throw result.error;

    const { data } = await this.storage().download(path);
    const existing = data ? await blobJson(data) : null;
    const createdAt = Date.parse(existing?.created_at || 'invalid');
    const stale = !Number.isFinite(createdAt) || Date.now() - createdAt > CLAIM_STALE_MS;
    if (stale) {
      await this.storage().remove([path]);
      result = await attempt();
      if (!result.error) return claim;
      if (!conflict(result.error)) throw result.error;
    }
    return null;
  }

  async releaseClaim(userId, hash, operationId) {
    const path = objectPaths(userId, hash).claim;
    const { data, error: readError } = await this.storage().download(path);
    if (readError) {
      if (notFound(readError)) return;
      throw readError;
    }
    const current = await blobJson(data);
    if (!current || current.operation_id !== operationId) return;
    const { error } = await this.storage().remove([path]);
    if (error && !notFound(error)) throw error;
  }

  async waitForMetadata(userId, hash) {
    for (let attempt = 0; attempt < WAIT_ATTEMPTS; attempt += 1) {
      const item = await this.get(userId, hash);
      if (item) return item;
      await pause(WAIT_MS);
    }
    throw Object.assign(new Error('gallery_write_in_progress_retry'), { status: 409 });
  }

  async create(userId, { image, title, description, firstImpression, contextNote, firstSeenAt = null }) {
    const existing = await this.get(userId, image.hash);
    if (existing) return { created: false, item: await this.signedItem(existing) };

    const claim = await this.tryClaim(userId, image.hash, 'create');
    if (!claim) {
      const item = await this.waitForMetadata(userId, image.hash);
      return { created: false, item: await this.signedItem(item) };
    }

    const paths = objectPaths(userId, image.hash, image.extension);
    let uploadedByThisRequest = false;
    try {
      const afterClaim = await this.get(userId, image.hash);
      if (afterClaim) return { created: false, item: await this.signedItem(afterClaim) };

      const upload = await this.storage().upload(paths.image, image.buffer, {
        contentType: image.mediaType,
        cacheControl: '31536000',
        upsert: false,
      });
      if (upload.error && !conflict(upload.error)) throw upload.error;
      uploadedByThisRequest = !upload.error;

      const now = new Date().toISOString();
      const metadata = {
        id: image.hash,
        content_hash: image.hash,
        storage_path: paths.image,
        media_type: image.mediaType,
        width: Number(image.width) || null,
        height: Number(image.height) || null,
        title: cleanTitle(title),
        first_description: cleanText(description, 1200),
        first_impression: cleanText(firstImpression, 800),
        first_context_note: cleanText(contextNote, 600),
        first_sent_at: firstSeenAt,
        send_count: firstSeenAt ? 1 : 0,
        created_at: now,
        updated_at: now,
      };
      if (!metadata.title || metadata.first_description.length < 20 || !metadata.first_impression) {
        throw Object.assign(new Error('gallery_metadata_incomplete'), { status: 400 });
      }

      const write = await this.storage().upload(paths.metadata, Buffer.from(JSON.stringify(metadata)), {
        contentType: 'application/json',
        cacheControl: '0',
        upsert: false,
      });
      if (write.error) {
        if (conflict(write.error)) {
          const wonByOtherRequest = await this.get(userId, image.hash);
          if (wonByOtherRequest) return { created: false, item: await this.signedItem(wonByOtherRequest) };
        }
        throw write.error;
      }
      return { created: true, item: await this.signedItem(metadata) };
    } catch (error) {
      if (uploadedByThisRequest) {
        const metadataExists = await this.get(userId, image.hash).catch(() => null);
        if (!metadataExists) {
          const cleanup = await this.storage().remove([paths.image]);
          if (cleanup.error) console.error('[gallery] compensation failed', cleanup.error.message);
        }
      }
      throw error;
    } finally {
      await this.releaseClaim(userId, image.hash, claim.operation_id).catch((error) => {
        console.error('[gallery] claim release failed', error.message);
      });
    }
  }

  async updateMetadata(userId, id, operation, mutate) {
    let claim = null;
    for (let attempt = 0; attempt < WAIT_ATTEMPTS && !claim; attempt += 1) {
      claim = await this.tryClaim(userId, id, operation);
      if (!claim) await pause(WAIT_MS);
    }
    if (!claim) throw Object.assign(new Error('gallery_write_in_progress_retry'), { status: 409 });
    try {
      const current = await this.get(userId, id);
      if (!current) throw Object.assign(new Error('gallery_item_not_found'), { status: 404 });
      const updated = { ...mutate(current), updated_at: new Date().toISOString() };
      const { error } = await this.storage().update(
        objectPaths(userId, id).metadata,
        Buffer.from(JSON.stringify(updated)),
        { contentType: 'application/json', cacheControl: '0', upsert: false },
      );
      if (error) throw error;
      return updated;
    } finally {
      await this.releaseClaim(userId, id, claim.operation_id).catch(() => {});
    }
  }

  async rename(userId, id, title) {
    const clean = cleanTitle(title);
    if (!clean) throw Object.assign(new Error('title_required'), { status: 400 });
    const updated = await this.updateMetadata(userId, id, 'rename', (current) => ({ ...current, title: clean }));
    return this.signedItem(updated);
  }

  async markSent(userId, id) {
    return this.updateMetadata(userId, id, 'mark-sent', (current) => {
      const now = new Date().toISOString();
      return {
        ...current,
        first_sent_at: current.first_sent_at || now,
        send_count: Number(current.send_count || 0) + 1,
      };
    });
  }

  async downloadImage(item) {
    const { data, error } = await this.storage().download(item.storage_path);
    if (error) throw error;
    const buffer = Buffer.from(await data.arrayBuffer());
    return {
      buffer,
      base64: buffer.toString('base64'),
      mediaType: item.media_type,
    };
  }
}
