import {ApiSession, get, post} from './client';

export type FlowStatus = {
  error?: boolean | string;
  flow_builder_enabled?: boolean;
  active_flow?: {flow_id: string; name: string; status: string; version: number} | null;
};

export const getFlowStatus = (session: ApiSession, projectId: string) =>
  get<FlowStatus>(`/flow-builder/status?project_id=${encodeURIComponent(projectId)}`, undefined, session);

export const setFlowEnabled = (session: ApiSession, projectId: string, flowId: string, enabled: boolean) =>
  post<any>('/flow-builder/toggle', {project_id: projectId, flow_id: flowId, enabled}, session);

export const listFlows = (session: ApiSession, projectId: string) =>
  post<any>('/flow-builder/list', {project_id: projectId}, session);

export const getFlow = (session: ApiSession, projectId: string, flowId: string) =>
  post<any>('/flow-builder/get', {project_id: projectId, flow_id: flowId}, session);

export const createFlow = (session: ApiSession, projectId: string, name: string, graph: any) =>
  post<any>('/flow-builder/create', {project_id: projectId, name, graph}, session);

export const updateFlowDraft = (session: ApiSession, projectId: string, flowId: string, name: string, graph: any) =>
  post<any>('/flow-builder/update-draft', {project_id: projectId, flow_id: flowId, name, graph}, session);

export const validateFlow = (session: ApiSession, projectId: string, graph: any) =>
  post<any>('/flow-builder/validate', {project_id: projectId, graph}, session);

export const publishFlow = (session: ApiSession, projectId: string, flowId: string) =>
  post<any>('/flow-builder/publish', {project_id: projectId, flow_id: flowId}, session);
