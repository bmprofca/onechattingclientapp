import { ApiSession, post } from './client';

export type BotSettingsPayload = {
  auto_reply_status: number;
  ai_provider: string;
  ai_model: string;
  context: string;
};

export const getBotSettings = (session: ApiSession, projectId: string) =>
  post<any>('/bot-reply/get-settings', { project_id: projectId }, session);

export const updateBotSettings = (
  session: ApiSession,
  projectId: string,
  settings: BotSettingsPayload,
) => post<any>('/bot-reply/update-context', { project_id: projectId, ...settings }, session);

export const getAutoCaseCreateStatus = (session: ApiSession, projectId: string) =>
  post<any>('/project/auto-case-create-status', { project_id: projectId }, session);

export const setAutoCaseCreate = (session: ApiSession, projectId: string, enabled: boolean) =>
  post<any>('/project/update-auto-case-create', {
    project_id: projectId,
    action: enabled ? 'active' : 'deactive',
  }, session);

export const setAutoReply = (session: ApiSession, projectId: string, enabled: boolean) =>
  post<any>('/bot-reply/toggle-auto-reply', { project_id: projectId, auto_reply: enabled }, session);

export const setAutoReplyType = (session: ApiSession, projectId: string, type: 'all' | 'new') =>
  post<any>('/bot-reply/update-auto-reply-type', { project_id: projectId, auto_reply_type: type }, session);

export type AgentApiKey = {
  unique_id: string;
  api_provider: string;
  api_key_masked: string;
  is_active: boolean;
};

export const listAgentApiKeys = (session: ApiSession, projectId: string) =>
  post<any>('/bot-reply/list-api-keys', { project_id: projectId }, session);

export const setPersonalKeyUsage = (session: ApiSession, projectId: string, enabled: boolean) =>
  post<any>('/bot-reply/toggle-personal-key', { project_id: projectId, agent_use_personal_key: enabled }, session);

export const saveAgentApiKey = (session: ApiSession, projectId: string, provider: string, apiKey: string) =>
  post<any>('/bot-reply/save-api-key', { project_id: projectId, api_provider: provider, api_key: apiKey }, session);

export const deleteAgentApiKey = (session: ApiSession, projectId: string, keyId: string) =>
  post<any>('/bot-reply/delete-api-key', { project_id: projectId, key_unique_id: keyId }, session);
