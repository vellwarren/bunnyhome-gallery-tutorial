import { createClient } from '@supabase/supabase-js';
import cors from 'cors';
import express from 'express';
import { replyAsCompanion, describeImageNeutral } from './ai.js';
import { requireUser } from './auth.js';
import { loadConfig } from './config.js';
import { GalleryStore } from './gallery-store.js';
import { decodeImage } from './image.js';

function safeError(error) {
  const publicErrors = new Set([
    'unsupported_image_type', 'invalid_base64_image', 'image_empty_or_too_large',
    'image_signature_mismatch', 'title_required', 'gallery_item_not_found',
    'gallery_write_in_progress_retry',
  ]);
  return publicErrors.has(error?.message) ? error.message : 'request_failed';
}

export function createApp({ config, supabase, store }) {
  const app = express();
  app.disable('x-powered-by');
  app.use(cors({ origin: config.webOrigin, methods: ['GET', 'POST', 'PATCH'], allowedHeaders: ['Content-Type', 'Authorization'] }));
  app.use(express.json({ limit: '14mb' }));
  app.get('/health', (_req, res) => res.json({ ok: true }));
  app.use('/api', requireUser(supabase));

  app.get('/api/gallery', async (req, res) => {
    try { res.json(await store.list(req.user.id)); }
    catch (error) {
      console.error('[gallery:list]', error.message);
      res.status(500).json({ error: 'gallery_unavailable' });
    }
  });

  app.patch('/api/gallery/:id', async (req, res) => {
    try { res.json(await store.rename(req.user.id, req.params.id, req.body?.title)); }
    catch (error) {
      console.error('[gallery:rename]', error.message);
      res.status(error.status || 500).json({ error: safeError(error) });
    }
  });

  app.post('/api/chat', async (req, res) => {
    const message = String(req.body?.message || '').trim().slice(0, 8000);
    const galleryId = String(req.body?.gallery_image_id || '').trim();
    if (!message && !req.body?.image && !galleryId) return res.status(400).json({ error: 'message_or_image_required' });
    if (req.body?.image && galleryId) return res.status(400).json({ error: 'choose_new_or_saved_image' });

    try {
      if (galleryId) {
        const item = await store.get(req.user.id, galleryId);
        if (!item) return res.status(404).json({ error: 'gallery_item_not_found' });
        const firstChatAppearance = !item.first_sent_at;
        const image = firstChatAppearance ? await store.downloadImage(item) : null;
        const companion = await replyAsCompanion(config, {
          message,
          image,
          memory: firstChatAppearance ? null : item,
        });
        await store.markSent(req.user.id, item.id);
        return res.json({ reply: companion.reply, reused_semantic_memory: !firstChatAppearance });
      }

      const image = req.body?.image ? decodeImage(req.body.image) : null;
      const save = req.body?.save_to_gallery === true && Boolean(image);
      const neutralPromise = save
        ? describeImageNeutral(config, image).then(
            (value) => ({ ok: true, value }),
            (error) => ({ ok: false, error }),
          )
        : null;
      const companion = await replyAsCompanion(config, { message, image, requestMetadata: save });

      let gallerySaved = null;
      let galleryError = null;
      if (save) {
        try {
          if (!companion.metadata) throw new Error('companion_gallery_metadata_missing');
          const neutral = await neutralPromise;
          if (!neutral.ok) throw neutral.error;
          const description = neutral.value;
          const saved = await store.create(req.user.id, {
            image,
            title: companion.metadata.title,
            description,
            firstImpression: companion.metadata.first_impression,
            contextNote: message,
            firstSeenAt: new Date().toISOString(),
          });
          gallerySaved = saved.item;
        } catch (error) {
          galleryError = 'gallery_save_failed';
          console.error('[gallery:save]', error.message);
        }
      }
      return res.json({ reply: companion.reply, gallery_saved: gallerySaved, gallery_error: galleryError });
    } catch (error) {
      console.error('[chat]', error.message);
      return res.status(error.status || 502).json({ error: safeError(error) });
    }
  });

  app.use((_req, res) => res.status(404).json({ error: 'not_found' }));
  return app;
}

if (process.env.NODE_ENV !== 'test') {
  const config = loadConfig();
  const supabase = createClient(config.supabaseUrl, config.serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const store = new GalleryStore({ supabase, bucket: config.bucket, signedUrlTtl: config.signedUrlTtl });
  await store.ensurePrivateBucket();
  createApp({ config, supabase, store }).listen(config.port, () => {
    console.log(`Gallery example server listening on http://localhost:${config.port}`);
  });
}
