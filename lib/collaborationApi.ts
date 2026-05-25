import { apiRequest } from "@/helpers/Config";

export type CollaborationHttpUser = {
  userId?: string;
  _id?: string;
  id?: string;
  email?: string;
  name?: string;
  userName?: string;
  userAvatar?: string;
  avatar?: string;
  role?: string;
  color?: string;
  cursor?: { x: number; y: number };
  isTyping?: boolean;
  lastSeen?: string;
  [key: string]: any;
};

export type CollaborationStatusPayload = {
  isActive?: boolean;
  activeUsers?: CollaborationHttpUser[];
  users?: CollaborationHttpUser[];
  role?: string;
  userRole?: string;
  permissions?: string[];
  roomId?: string;
  [key: string]: any;
};

const unwrap = <T>(response: any): T => (response?.data ?? response) as T;

export const initCollaborationSession = async (projectId: string, eventId: string) => {
  return unwrap<CollaborationStatusPayload>(
    await apiRequest(`/collaboration/${projectId}/${eventId}/init`, "POST", {}, true)
  );
};

export const getCollaborationStatus = async (projectId: string, eventId: string) => {
  return unwrap<CollaborationStatusPayload>(
    await apiRequest(`/collaboration/${projectId}/${eventId}/status`, "GET", null, true)
  );
};

export const getCollaborationUsers = async (projectId: string, eventId: string) => {
  return unwrap<any>(
    await apiRequest(`/collaboration/${projectId}/${eventId}/users`, "GET", null, true)
  );
};

export const forceSyncCollaborationRoom = async (projectId: string, eventId: string) => {
  return unwrap<any>(
    await apiRequest(`/collaboration/${projectId}/${eventId}/sync`, "POST", {}, true)
  );
};

export const getActiveCollaborationRooms = async () => {
  return unwrap<any>(
    await apiRequest(`/collaboration/rooms`, "GET", null, true)
  );
};
