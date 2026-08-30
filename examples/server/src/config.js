const required = (name) => {
  const value = String(process.env[name] || '').trim();
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
};

export function loadConfig() {
  const signedUrlTtl = Number(process.env.SIGNED_URL_TTL_SECONDS || 300);
  return {
    port: Number(process.env.PORT || 8787),
    webOrigin: String(process.env.WEB_ORIGIN || 'http://localhost:5173'),
    supabaseUrl: required('SUPABASE_URL'),
    serviceRoleKey: required('SUPABASE_SERVICE_ROLE_KEY'),
    bucket: String(process.env.GALLERY_BUCKET || 'private-gallery'),
    signedUrlTtl: Number.isFinite(signedUrlTtl) ? Math.min(900, Math.max(60, signedUrlTtl)) : 300,
    anthropicApiKey: required('ANTHROPIC_API_KEY'),
    anthropicModel: required('ANTHROPIC_MODEL'),
    companionSystemPrompt: String(process.env.COMPANION_SYSTEM_PROMPT || '').trim()
      || 'You are a warm personal companion. Reply naturally to the user.',
  };
}
