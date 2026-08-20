import * as Keychain from 'react-native-keychain';
import defaultCaseNames from '../data/caseNames.json';

const SERVICE = 'com.onechatting.case-names';

export async function loadCaseNames(): Promise<string[]> {
  try {
    const stored = await Keychain.getGenericPassword({service: SERVICE});
    const custom = stored ? JSON.parse(stored.password) : [];
    return Array.from(new Set([
      ...(Array.isArray(defaultCaseNames) ? defaultCaseNames : []),
      ...(Array.isArray(custom) ? custom : []),
    ].filter(name => typeof name === 'string' && name.trim())));
  } catch {
    return Array.isArray(defaultCaseNames) ? defaultCaseNames : [];
  }
}

export async function saveCustomCaseName(name: string): Promise<string[]> {
  const trimmed = name.trim();
  if (!trimmed) return loadCaseNames();
  const names = await loadCaseNames();
  const next = Array.from(new Set([...names, trimmed]));
  const custom = next.filter(item => !defaultCaseNames.includes(item));
  await Keychain.setGenericPassword('case-names', JSON.stringify(custom), {service: SERVICE});
  return next;
}
