import crypto from 'node:crypto';

export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
export const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

const extensionFor = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

function hasExpectedSignature(buffer, mediaType) {
  if (mediaType === 'image/jpeg') {
    return buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  }
  if (mediaType === 'image/png') {
    return buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  }
  if (mediaType === 'image/webp') {
    return buffer.length >= 12
      && buffer.subarray(0, 4).toString('ascii') === 'RIFF'
      && buffer.subarray(8, 12).toString('ascii') === 'WEBP';
  }
  return false;
}

export function decodeImage(input) {
  const mediaType = String(input?.media_type || '').toLowerCase();
  if (!IMAGE_TYPES.has(mediaType)) throw Object.assign(new Error('unsupported_image_type'), { status: 400 });

  const encoded = String(input?.data || '')
    .replace(/^data:[^;]+;base64,/i, '')
    .replace(/\s+/g, '');
  if (!encoded || !/^[A-Za-z0-9+/]*={0,2}$/.test(encoded) || encoded.length % 4 === 1) {
    throw Object.assign(new Error('invalid_base64_image'), { status: 400 });
  }

  const buffer = Buffer.from(encoded, 'base64');
  if (!buffer.length || buffer.length > MAX_IMAGE_BYTES) {
    throw Object.assign(new Error('image_empty_or_too_large'), { status: 400 });
  }
  if (!hasExpectedSignature(buffer, mediaType)) {
    throw Object.assign(new Error('image_signature_mismatch'), { status: 400 });
  }

  const hash = crypto.createHash('sha256').update(buffer).digest('hex');
  return { buffer, hash, mediaType, extension: extensionFor[mediaType], base64: buffer.toString('base64') };
}

export function cleanTitle(value) {
  return Array.from(String(value || '').trim()).slice(0, 60).join('');
}

export function cleanText(value, limit) {
  return Array.from(String(value || '').replace(/\s+/g, ' ').trim()).slice(0, limit).join('');
}

