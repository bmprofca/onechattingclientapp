import {ApiSession, post} from './client';

export type ListItem = Record<string, unknown>;
export const unwrapList = (response: any): ListItem[] => {
  const value = response?.list || response?.data?.list || response?.data || response?.results || [];
  return Array.isArray(value) ? value : [];
};
export const getInbox = (session: ApiSession, projectId: string) => post<any>('/message/chat-list', {project_id: projectId, page: 1, limit: 30}, session);
export const getOpenCases = (session: ApiSession, projectId: string) => post<any>('/message/open-case-list', {project_id: projectId, page: 1, limit: 30}, session);
export const getCampaigns = (session: ApiSession, projectId: string) => post<any>('/campaign/list', {project_id: projectId, page: 1, limit: 30}, session);
export const getContacts = (session: ApiSession, projectId: string) => post<any>('/contact/contact-list', {project_id: projectId, page: 1, limit: 30}, session);
export const getTemplates = (session: ApiSession, projectId: string) => post<any>('/template/template-list', {project_id: projectId, page: 1, limit: 30}, session);
export const getProjectInfo = (session: ApiSession, projectId: string) => post<any>('/project/info', {project_id: projectId}, session);
export const getProjectMeta = (session: ApiSession, projectId: string) => post<any>('/project/meta-details', {project_id: projectId}, session);
export const getUnreadCount = (session: ApiSession, projectId: string) => post<any>('/message/total-unread-count', {project_id: projectId}, session);
