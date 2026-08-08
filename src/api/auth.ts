import { ApiSession, post } from './client';

export type Project = { id: string; name: string; owned?: boolean; ownerName?: string };
export type Profile = { name?: string; email?: string; mobile?: string; country_code?: string; gender?: string; firm_name?: string; business_name?: string; business_type?: string };
export type LoginResponse = { token: string; username: string; profile?: Profile; projects?: Project[] };

const normalizeProjects = (value: any): Project[] => {
  const list = Array.isArray(value) ? value : value?.list || [];
  return list.map((project: any) => ({id: String(project.id || project.project_id), name: String(project.name || project.project_name || 'Untitled project'), owned: Boolean(project.owned), ownerName: project.owner_name})).filter((project: Project) => project.id);
};

export async function login(email: string, password: string): Promise<LoginResponse> {
  const response = await post<any>('/account/login', { email, password });
  const source = response.data || response;
  if (!source.token || !source.username) throw new Error(response.message || 'The server returned an incomplete login response.');
  return { token: source.token, username: source.username, profile: source.profile || response.profile, projects: normalizeProjects(source.projects || response.projects) };
}

export async function getAccountProfile(session: ApiSession): Promise<{username: string; profile?: Profile; balance?: number; projects: Project[]; projectCount?: number}> {
  const response = await post<any>('/account/profile', {}, session);
  const source = response.data || response;
  return {username: source.username || session.username, profile: source.profile, balance: source.balance, projects: normalizeProjects(source.projects), projectCount: source.projects?.project_count};
}

export async function register(fields: {
  name: string;
  email: string;
  password: string;
  confirm_password: string;
  firm_name: string;
  mobile: string;
  country_code: string;
}): Promise<LoginResponse> {
  const response = await post<any>('/account/register', fields);
  const source = response.data || response;
  if (!source.token || !source.username) throw new Error(response.message || 'Registration succeeded but session was incomplete.');
  return {
    token: source.token,
    username: source.username,
    profile: source.profile || response.profile,
    projects: normalizeProjects(source.project?.projects || source.projects || response.projects),
  };
}

export async function requestPasswordReset(email: string): Promise<void> {
  await post('/account/reset-password-request', { email });
}
