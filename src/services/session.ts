import * as Keychain from 'react-native-keychain';
import {Profile, Project} from '../api/auth';

const SERVICE = 'com.onechatting.session';
export type Session = {token: string; username: string; profile?: Profile; projects: Project[]};

export async function loadSession(): Promise<Session | null> {
  const saved = await Keychain.getGenericPassword({service: SERVICE});
  return saved ? JSON.parse(saved.password) as Session : null;
}
export async function saveSession(session: Session) { await Keychain.setGenericPassword(session.username, JSON.stringify(session), {service: SERVICE}); }
export async function clearSession() { await Keychain.resetGenericPassword({service: SERVICE}); }
