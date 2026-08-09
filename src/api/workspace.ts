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
export const getProjectDashboard = (session: ApiSession, projectId: string) =>
  post<any>('/project/dashboard', { project_id: projectId }, session);
export const getUnreadCount = (session: ApiSession, projectId: string) =>
  post<any>('/message/total-unread-count', { project_id: projectId }, session);
export const getChatHistory = (session: ApiSession, projectId: string, contactNumber: string, lastId?: number) =>
  post<any>('/message/chat-history', { project_id: projectId, number: contactNumber, last_id: lastId || 0 }, session);
export const markAsRead = (session: ApiSession, projectId: string, contactNumber: string) =>
  post<any>('/message/mark-as-read', { project_id: projectId, number: contactNumber }, session);
export const sendMessage = (session: ApiSession, projectId: string, contactNumber: string, message: string) =>
  post<any>('/message/send-text-message', { project_id: projectId, number: contactNumber, message_type: 'text', message }, session);
export const getContactDetails = (session: ApiSession, projectId: string, contactNumber: string) =>
  post<any>('/contact/contact-details', { project_id: projectId, number: contactNumber }, session);
export const getOpenCaseCount = (session: ApiSession, projectId: string, contactNumber: string) =>
  post<any>('/message/open-case-count', { project_id: projectId, number: contactNumber }, session);

// ---- Media messages ----

export type SendMediaOptions = {
  isReply?: boolean;
  replyWamid?: string;
};

const replyFields = (options: SendMediaOptions = {}) => ({
  is_reply: options.isReply || false,
  reply_wamid: options.replyWamid || null,
});

export async function sendImageMessage(
  session: ApiSession,
  projectId: string,
  contactNumber: string,
  imageLink: string,
  caption?: string,
) {
  return post('/message/send-image-message', {
    project_id: projectId,
    number: contactNumber,
    image_link: imageLink,
    message: caption || '',
  }, session);
}

export async function sendVideoMessage(
  session: ApiSession,
  projectId: string,
  contactNumber: string,
  videoLink: string,
  caption?: string,
) {
  return post('/message/send-video-message', {
    project_id: projectId,
    number: contactNumber,
    video_link: videoLink,
    message: caption || '',
  }, session);
}

export async function sendDocumentMessage(
  session: ApiSession,
  projectId: string,
  contactNumber: string,
  documentLink: string,
  documentName: string,
  caption?: string,
) {
  return post('/message/send-document-message', {
    project_id: projectId,
    number: contactNumber,
    document_link: documentLink,
    document_name: documentName,
    message: caption || '',
  }, session);
}
export const sendAudioMessage = (
  session: ApiSession,
  projectId: string,
  number: string,
  audioLink: string,
  isVoice = false,
  options: SendMediaOptions = {},
) =>
  post<any>(
    '/message/send-audio-message',
    { project_id: projectId, number, audio_link: audioLink, is_voice: isVoice, ...replyFields(options) },
    session,
  );

export async function createProject(
  session: ApiSession,
  companyName: string,
  projectName: string,
  packageId: string
) {
  return post<any>('/project/create-project', {
    company_name: companyName,
    project_name: projectName,
    package_id: packageId,
  }, session);
}

export async function editProject(
  session: ApiSession,
  companyName: string,
  projectName: string,
) {
  return post<any>('/project/edit-project', {
    company_name: companyName,
    project_name: projectName,
  }, session);
}

export async function embedSignup(session: ApiSession, projectId: string) {
  return post<any>('/project/embed-signup', {
    project_id: projectId,
  }, session);
}

export async function submitWabaId(session: ApiSession, projectId: string, wabaId: string) {
  return post<any>('/project/submit-waba-id', {
    project_id: projectId,
    waba_id: wabaId,
  }, session);
}

export async function getWabaInformation(session: ApiSession, projectId: string) {
  return post<any>('/project/waba-information', {
    project_id: projectId,
  }, session);
}