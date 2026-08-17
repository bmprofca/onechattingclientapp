import { ApiSession, post } from './client';
import { formatImageUrl } from '../utils/imageUrl';

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
export const unwrapItem = (response: any): Record<string, unknown> | null => {
  return response?.item || response?.data || response || null;
};
export const getInbox = (session: ApiSession, projectId: string, search?: string) =>
  post<any>(
    '/message/chat-list',
    { project_id: projectId, page: 1, limit: 30, search: search || '' },
    session,
  );
export const getOpenCases = (session: ApiSession, projectId: string, search?: string) =>
  post<any>(
    '/message/open-case-list',
    { project_id: projectId, page: 1, limit: 30, search: search || '' },
    session,
  );
export const getCampaigns = (session: ApiSession, projectId: string) =>
  post<any>(
    '/campaign/list',
    { project_id: projectId, page: 1, limit: 30 },
    session,
  );
export const getCampaignDetails = (session: ApiSession, projectId: string, campaignId: string) =>
  post<any>(
    '/campaign/campaign-details',
    { project_id: projectId, campaign_id: campaignId },
    session,
  );
export const getCampaignMessages = (session: ApiSession, projectId: string, campaignId: string) =>
  post<any>(
    '/campaign/campaign-messages',
    { project_id: projectId, campaign_id: campaignId },
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
export const sendMessage = (session: ApiSession, projectId: string, contactNumber: string, message: string, replyWamid?: string) =>
  post<any>('/message/send-text-message', {
    project_id: projectId,
    number: contactNumber,
    message_type: 'text',
    message,
    ...(replyWamid ? { is_reply: true, reply_wamid: replyWamid } : {}),
  }, session);
export const getContactDetails = (session: ApiSession, projectId: string, contactNumber: string) =>
  post<any>('/contact/contact-details', { project_id: projectId, number: contactNumber }, session);
export const getOpenCaseCount = (session: ApiSession, projectId: string, contactNumber: string) =>
  post<any>('/message/open-case-count', { project_id: projectId, number: contactNumber }, session);

export const getTemplates = (session: ApiSession, projectId: string, status?: string) =>
  post<any>('/template/template-list', { project_id: projectId, status }, session);

export const sendTemplate = (session: ApiSession, projectId: string, contactNumber: string, templateId: string, components: any[]) =>
  post<any>('/message/send-template', { project_id: projectId, number: contactNumber, template_id: templateId, component: components }, session);

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

export type EditProjectPayload = {
  project_id?: string;
  company_name: string;
  project_name: string;
  profile_image?: string;
  logo?: string;
  image?: string;
  description?: string;
  website?: string;
  email?: string;
  mobile?: string;
  [key: string]: any;
};

export async function editProject(
  session: ApiSession,
  data: EditProjectPayload | string,
  projectName?: string,
) {
  const payload = typeof data === 'string'
    ? { company_name: data, project_name: projectName || '' }
    : {
        ...data,
        company_name: data.company_name,
        project_name: data.project_name,
        profile_image: formatImageUrl(data.profile_image || data.logo || data.image || data.profile_picture),
      };
  return post<any>('/project/edit-project', payload, session);
}

export type CreateCampaignPayload = {
  project_id: string;
  campaign_name: string;
  template_id: string;
  component?: any[];
  numbers?: string[];
  contact_list?: string[];
  schedule_time?: string;
  is_scheduled?: boolean;
  file_url?: string;
  [key: string]: any;
};

export async function createCampaign(
  session: ApiSession,
  payload: CreateCampaignPayload,
) {
  try {
    return await post<any>('/campaign/create-campaign', payload, session);
  } catch (error: any) {
    if (error?.message?.includes('404') || error?.message?.includes('Cannot POST')) {
      return await post<any>('/campaign/create', payload, session);
    }
    throw error;
  }
}

export const getContactList = (
  session: ApiSession,
  projectId: string,
  page = 1,
  limit = 50,
  search = '',
) =>
  post<any>(
    '/contact/contact-list',
    { project_id: projectId, page, limit, search },
    session,
  );

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
export const getPlans = (session: ApiSession) =>
  post<any>('/plan', {}, session);

export type PlanPackage = {
  amount: string;
  package_id: string;
};

export type PlanPackages = {
  monthly: PlanPackage;
  yearly: PlanPackage;
};