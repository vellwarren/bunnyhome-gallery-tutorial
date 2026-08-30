import { cleanText, cleanTitle } from './image.js';

export const NEUTRAL_VISION_PROMPT = [
  'You are a private neutral image-indexing worker, not the companion and not a participant in the conversation.',
  'Return exactly one Chinese paragraph containing only directly visible facts.',
  'Cover the main subjects, composition, colors, lighting, and clearly readable text when present.',
  'Do not infer identity, psychology, emotion, intention, relationship, backstory, or meaning.',
  'Do not address anyone. Do not add a label, markdown, JSON, or commentary.',
].join(' ');

export const SAVE_METADATA_TOOL = {
  name: 'save_gallery_metadata',
  description: [
    'Available only because the user chose to save this image.',
    'First write a natural visible reply in your normal companion voice.',
    'Never turn the visible reply into an objective catalog description.',
    'Then call this tool exactly once. Neutral visual indexing is handled separately.',
  ].join(' '),
  input_schema: {
    type: 'object',
    additionalProperties: false,
    required: ['title', 'first_impression'],
    properties: {
      title: { type: 'string', description: 'A short natural Chinese title.' },
      first_impression: {
        type: 'string',
        description: 'A private first-person note about this first encounter, not an objective description or permanent fact.',
      },
    },
  },
};

async function anthropicMessage(config, body) {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': config.anthropicApiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({ model: config.anthropicModel, max_tokens: 1000, ...body }),
    signal: AbortSignal.timeout(45_000),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`model_request_failed:${response.status}:${data?.error?.message || 'unknown'}`);
  return data;
}

const imageBlock = (image) => ({
  type: 'image',
  source: { type: 'base64', media_type: image.mediaType, data: image.base64 },
});

export async function describeImageNeutral(config, image) {
  const result = await anthropicMessage(config, {
    system: NEUTRAL_VISION_PROMPT,
    max_tokens: 400,
    temperature: 0.1,
    messages: [{
      role: 'user',
      content: [imageBlock(image), { type: 'text', text: 'Write the neutral private visual index now.' }],
    }],
  });
  const description = cleanText(
    result.content?.filter((part) => part.type === 'text').map((part) => part.text).join(' '),
    1200,
  );
  if (Array.from(description).length < 20) throw new Error('neutral_description_missing');
  return description;
}

export async function replyAsCompanion(config, { message, image, memory, requestMetadata = false }) {
  const content = [];
  if (image) content.push(imageBlock(image));
  if (memory) {
    content.push({
      type: 'text',
      text: [
        '[saved gallery image — previously seen]',
        `Title: ${memory.title || 'untitled'}`,
        `Lossy semantic memory from its first viewing: ${memory.first_description}`,
        'Treat it as the same saved item returning. Do not claim to be inspecting pixels now.',
        `User message: ${message || '(image only)'}`,
      ].join('\n'),
    });
  } else {
    content.push({ type: 'text', text: message || 'Please respond naturally to this image.' });
  }

  const result = await anthropicMessage(config, {
    system: config.companionSystemPrompt,
    messages: [{ role: 'user', content }],
    ...(requestMetadata ? { tools: [SAVE_METADATA_TOOL], tool_choice: { type: 'auto' } } : {}),
  });
  const reply = cleanText(
    result.content?.filter((part) => part.type === 'text').map((part) => part.text).join('\n'),
    4000,
  );
  const tool = result.content?.find((part) => part.type === 'tool_use' && part.name === SAVE_METADATA_TOOL.name);
  const metadata = tool ? {
    title: cleanTitle(tool.input?.title),
    first_impression: cleanText(tool.input?.first_impression, 800),
  } : null;

  if (!reply) throw new Error('companion_reply_missing');
  return { reply, metadata };
}

