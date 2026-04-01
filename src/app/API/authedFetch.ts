import { fetchAuthSession } from 'aws-amplify/auth';

const API_URL = import.meta.env.VITE_USER_API_URL as string;

async function getIdToken(): Promise<string> {
  const session = await fetchAuthSession();
  const token = session.tokens?.idToken?.toString();
  if (!token) throw new Error('No active session');
  return token;
}

export async function authedFetch(path: string, init?: RequestInit): Promise<Response> {
  const token = await getIdToken();
  return fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...init?.headers,
      Authorization: `Bearer ${token}`,
    },
  });
}
