import { createClient } from '@supabase/supabase-js';

const apply = process.argv.includes('--apply');
const supabaseUrl = String(process.env.SUPABASE_URL || '').trim();
const serviceRoleKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
const bucket = String(process.env.GALLERY_BUCKET || 'private-gallery');
if (!supabaseUrl || !serviceRoleKey) throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required');

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const storage = supabase.storage.from(bucket);

async function list(prefix) {
  const { data, error } = await storage.list(prefix, { limit: 1000 });
  if (error) throw error;
  return data || [];
}

async function readJson(path) {
  const { data, error } = await storage.download(path);
  if (error) return null;
  try { return JSON.parse(await data.text()); }
  catch { return null; }
}

const { data: bucketInfo, error: bucketError } = await supabase.storage.getBucket(bucket);
if (bucketError || !bucketInfo) throw new Error(`Bucket not found: ${bucket}`);
if (bucketInfo.public) throw new Error(`Refusing cleanup because bucket is public: ${bucket}`);

const users = (await list('users')).filter((entry) => !entry.id && entry.name && !entry.name.includes('/'));
const deletions = [];
const reports = [];
const staleBefore = Date.now() - 2 * 60 * 1000;

for (const user of users) {
  const root = `users/${user.name}`;
  const [images, metadata, claims] = await Promise.all([
    list(`${root}/images`),
    list(`${root}/meta`),
    list(`${root}/claims`),
  ]);
  const imageByHash = new Map(images.flatMap((file) => {
    const match = /^([a-f0-9]{64})\.(?:jpg|png|webp)$/.exec(file.name);
    return match ? [[match[1], file.name]] : [];
  }));
  const metadataHashes = new Set(metadata.flatMap((file) => {
    const match = /^([a-f0-9]{64})\.json$/.exec(file.name);
    return match ? [match[1]] : [];
  }));

  for (const [hash, name] of imageByHash) {
    if (!metadataHashes.has(hash)) {
      const path = `${root}/images/${name}`;
      reports.push({ type: 'orphan_image', path });
      deletions.push(path);
    }
  }
  for (const hash of metadataHashes) {
    if (!imageByHash.has(hash)) reports.push({ type: 'metadata_missing_image', path: `${root}/meta/${hash}.json` });
  }
  for (const file of claims.filter((entry) => /^[a-f0-9]{64}\.json$/.test(entry.name))) {
    const path = `${root}/claims/${file.name}`;
    const claim = await readJson(path);
    if (!claim || Date.parse(claim.created_at || 'invalid') < staleBefore) {
      reports.push({ type: 'stale_claim', path });
      deletions.push(path);
    }
  }
}

console.log(JSON.stringify({ mode: apply ? 'apply' : 'dry-run', bucket, reports }, null, 2));
if (apply && deletions.length) {
  for (let index = 0; index < deletions.length; index += 100) {
    const batch = deletions.slice(index, index + 100);
    const { error } = await storage.remove(batch);
    if (error) throw error;
  }
  console.log(JSON.stringify({ removed: deletions.length }));
}

