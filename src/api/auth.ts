import {post} from './client';

export type Project = {id: string; name: string};
export type Profile = {name?: string; email?: string; mobile?: string};
export type LoginResponse = {token: string; username: string; profile?: Profile; projects?: Project[]};

export async function login(email: string, password: string): Promise<LoginResponse> {
  const response = await post<any>('/account/login', {email, password});
  const source = response.data || response;
  if (!source.token || !source.username) throw new Error(response.message || 'The server returned an incomplete login response.');
  return {token: source.token, username: source.username, profile: source.profile || response.profile, projects: source.projects || response.projects || []};
}
