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
export const getProjectMeta = (session: ApiSession, projectId: string) =>
  post<any>('/project/meta-details', { project_id: projectId }, session);
export const getUnreadCount = (session: ApiSession, projectId: string) =>
  post<any>('/message/total-unread-count', { project_id: projectId }, session);
export const getChatHistory = (session: ApiSession, projectId: string, contactNumber: string, lastId?: number) =>
  post<any>('/message/chat-history', { project_id: projectId, number: contactNumber, last_id: lastId || 0 }, session);
export const markAsRead = (session: ApiSession, projectId: string, contactNumber: string) =>
  post<any>('/message/mark-as-read', { project_id: projectId, number: contactNumber }, session);
export const sendMessage = (session: ApiSession, projectId: string, contactNumber: string, message: string) =>
  post<any>('/message/send', { project_id: projectId, number: contactNumber, message_type: 'text', message }, session);
export const getContactDetails = (session: ApiSession, projectId: string, contactNumber: string) =>
  post<any>('/contact/contact-details', { project_id: projectId, number: contactNumber }, session);
export const getOpenCaseCount = (session: ApiSession, projectId: string, contactNumber: string) =>
  post<any>('/message/open-case-count', { project_id: projectId, number: contactNumber }, session);
