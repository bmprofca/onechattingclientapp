import { ApiSession, post } from './client';

export type ListItem = Record<string, unknown>;
export const unwrapList = (response: any): ListItem[] => {
  const value =
    response?.list ||
    response?.data?.list ||
    response?.data ||
    response?.results ||
    [];
  return Array.isArray(value) ? value : [];
};

// campaign-details returns a single object under `data`, not an array —
// unwrapList would coerce that to [] since Array.isArray(data) is false.
export const unwrapItem = (response: any): Record<string, any> => {
  return response?.data || response?.item || {};
};

export const getInbox = (session: ApiSession, projectId: string) =>
  post<any>(
    '/message/chat-list',
    { project_id: projectId, page: 1, limit: 30 },
    session,
  );
export const getOpenCases = (session: ApiSession, projectId: string) =>
  post<any>(
    '/message/open-case-list',
    { project_id: projectId, page: 1, limit: 30 },
    session,
  );
export const getCampaigns = (session: ApiSession, projectId: string) =>
  post<any>(
    '/campaign/list',
    { project_id: projectId, page: 1, limit: 30 },
    session,
  );
export const getCampaignDetails = (
  session: ApiSession,
  projectId: string,
  campaignId: string,
) =>
  post<any>(
    '/campaign/campaign-details',
    { project_id: projectId, campaign_id: campaignId },
    session,
  );
export const getCampaignMessages = (
  session: ApiSession,
  projectId: string,
  campaignId: string,
  page = 1,
  limit = 50,
) =>
  post<any>(
    '/campaign/campaign-messages',
    { project_id: projectId, campaign_id: campaignId, page, limit },
    session,
  );
export const getProjectMeta = (session: ApiSession, projectId: string) =>
  post<any>('/project/meta-details', { project_id: projectId }, session);
export const getUnreadCount = (session: ApiSession, projectId: string) =>
  post<any>('/message/total-unread-count', { project_id: projectId }, session);