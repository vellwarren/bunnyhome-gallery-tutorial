function bearerToken(value) {
  const match = /^Bearer\s+(.+)$/i.exec(String(value || '').trim());
  return match?.[1]?.trim() || null;
}

export function requireUser(supabase) {
  return async (req, res, next) => {
    const token = bearerToken(req.headers.authorization);
    if (!token) return res.status(401).json({ error: 'authentication_required' });

    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data?.user?.id) {
      return res.status(401).json({ error: 'invalid_or_expired_token' });
    }

    req.user = { id: data.user.id };
    return next();
  };
}

export { bearerToken };

