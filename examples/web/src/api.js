const apiUrl = String(import.meta.env.VITE_API_URL || 'http://localhost:8787').replace(/\/$/, '');

async function request(path, accessToken, options = {}) {
  const response = await fetch(`${apiUrl}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...options.headers,
    },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
  return data;
}

export const galleryApi = {
  list: (token) => request('/api/gallery', token),
  rename: (token, id, title) => request(`/api/gallery/${id}`, token, {
    method: 'PATCH',
    body: JSON.stringify({ title }),
  }),
  chat: (token, body) => request('/api/chat', token, {
    method: 'POST',
    body: JSON.stringify(body),
  }),
};

export function fileAsImagePayload(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('image_read_failed'));
    reader.onload = () => {
      const dataUrl = String(reader.result || '');
      resolve({ media_type: file.type, data: dataUrl });
    };
    reader.readAsDataURL(file);
  });
}

