const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:4000';

async function request(path, token, options = {}) {
  const res = await fetch(`${SERVER_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(options.headers || {}),
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Request failed: ${res.status}`);
  }
  return res.json();
}

export const fetchUsers = (token) => request('/api/users', token);
export const fetchConversations = (token) => request('/api/conversations', token);

export const fetchMessages = (token, convId, { limit = 20, before } = {}) => {
  const params = new URLSearchParams({ limit: String(limit) });
  if (before) params.set('before', String(before));
  return request(`/api/conversations/${convId}/messages?${params.toString()}`, token);
};

export const fetchConversationId = (token, uid) =>
  request(`/api/conversations/with/${uid}`, token);
