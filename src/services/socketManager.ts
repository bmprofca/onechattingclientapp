import { io, Socket } from 'socket.io-client';
import { API_BASE_URL } from '../api/client';
import { notificationService } from './notificationService';

export type ConnectionStatus = 'connected' | 'connecting' | 'disconnected';

class SocketManager {
  private socket: Socket | null = null;
  private isConnected: boolean = false;
  private messageCallbacks: ((data: any) => void)[] = [];
  private messageStatusCallbacks: ((data: any) => void)[] = [];
  private chatAssignedCallbacks: ((data: any) => void)[] = [];
  private unreadCountCallbacks: ((data: any) => void)[] = [];
  private caseStatusCallbacks: ((data: any) => void)[] = [];
  private connectionChangeCallbacks: ((status: ConnectionStatus) => void)[] = [];

  private currentProjectId: string | null = null;

  connect(token: string, username: string) {
    try {
      if (this.socket) {
        console.log('🔄 Socket already exists, reusing connection');
        return;
      }

      console.log('🔌 Creating new socket connection...');

      this.socket = io(API_BASE_URL, {
        transports: ['websocket', 'polling'], // Prioritize websocket for RN
        reconnectionAttempts: Infinity,
        reconnectionDelay: 1000,
        auth: {
          token,
          username,
        },
      });

      this.notifyConnectionChange('connecting');

      this.socket.on('connect', () => {
        console.log('✅ Socket Connected:', this.socket?.id);
        this.isConnected = true;
        this.notifyConnectionChange('connected');
        this.socket?.emit('auth', { username, token });
      });

      this.socket.on('auth_status', (msg) => {
        console.log('✅ Auth Status:', msg);
      });

      this.socket.on('chat', (data) => {
        if (!this.isPayloadForSelectedProject(data?.project_id)) return;
        this.messageCallbacks.forEach((callback) => callback(data));

        // Trigger native device notification for incoming messages
        this.triggerNativeNotification(data);
      });

      this.socket.on('message_status', (data) => {
        if (!this.isPayloadForSelectedProject(data?.project_id)) return;
        this.messageStatusCallbacks.forEach((callback) => callback(data));
      });

      this.socket.on('chat_assigned', (data) => {
        if (!this.isPayloadForSelectedProject(data?.project_id)) return;
        this.chatAssignedCallbacks.forEach((callback) => callback(data));
      });

      this.socket.on('total_unread_count', (data) => {
        if (!this.isPayloadForSelectedProject(data?.project_id)) return;
        this.unreadCountCallbacks.forEach((callback) => callback(data));
      });

      this.socket.on('case_status', (data) => {
        this.caseStatusCallbacks.forEach((callback) => callback(data));
      });

      this.socket.on('connect_error', (error) => {
        console.log('❌ Socket Connection error:', error.message);
        this.isConnected = false;
        this.notifyConnectionChange('disconnected');
      });

      this.socket.on('disconnect', (reason) => {
        console.log('🔌 Socket Disconnected:', reason);
        this.isConnected = false;
        this.notifyConnectionChange('disconnected');
      });
    } catch (error) {
      console.error('Socket connection failed:', error);
      this.notifyConnectionChange('disconnected');
    }
  }

  setProjectId(projectId: string | null | undefined) {
    this.currentProjectId = projectId || null;
  }

  private isPayloadForSelectedProject(payloadProjectId: string | undefined): boolean {
    if (payloadProjectId == null || payloadProjectId === '') return true;
    if (this.currentProjectId == null || this.currentProjectId === '') return true;
    return String(payloadProjectId) === String(this.currentProjectId);
  }

  private notifyConnectionChange(status: ConnectionStatus) {
    this.connectionChangeCallbacks.forEach((callback) => callback(status));
  }

  onChat(callback: (data: any) => void) {
    this.messageCallbacks.push(callback);
    return () => {
      this.messageCallbacks = this.messageCallbacks.filter((cb) => cb !== callback);
    };
  }

  onMessageStatus(callback: (data: any) => void) {
    this.messageStatusCallbacks.push(callback);
    return () => {
      this.messageStatusCallbacks = this.messageStatusCallbacks.filter((cb) => cb !== callback);
    };
  }

  onChatAssigned(callback: (data: any) => void) {
    this.chatAssignedCallbacks.push(callback);
    return () => {
      this.chatAssignedCallbacks = this.chatAssignedCallbacks.filter((cb) => cb !== callback);
    };
  }

  onTotalUnreadCount(callback: (data: any) => void) {
    this.unreadCountCallbacks.push(callback);
    return () => {
      this.unreadCountCallbacks = this.unreadCountCallbacks.filter((cb) => cb !== callback);
    };
  }

  onCaseStatus(callback: (data: any) => void) {
    this.caseStatusCallbacks.push(callback);
    return () => {
      this.caseStatusCallbacks = this.caseStatusCallbacks.filter((cb) => cb !== callback);
    };
  }

  onConnectionChange(callback: (status: ConnectionStatus) => void) {
    this.connectionChangeCallbacks.push(callback);
    callback(this.isConnected ? 'connected' : (this.socket ? 'connecting' : 'disconnected'));
    return () => {
      this.connectionChangeCallbacks = this.connectionChangeCallbacks.filter((cb) => cb !== callback);
    };
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.isConnected = false;
      this.notifyConnectionChange('disconnected');
    }
  }

  getConnectionStatus(): ConnectionStatus {
    if (this.isConnected) return 'connected';
    if (this.socket) return 'connecting';
    return 'disconnected';
  }

  ensureConnected() {
    if (this.socket && !this.isConnected) {
      console.log('🔄 Reconnecting socket...');
      this.socket.connect();
    }
  }

  private triggerNativeNotification(data: any) {
    try {
      const msg = data?.message || {};
      const contact = data?.contact || {};

      // Only notify on incoming messages
      const isIncoming =
        msg.type === 'in' ||
        msg.message_type === 'in' ||
        msg.direction === 'in';
      if (!isIncoming) return;

      const contactNumber = String(
        contact.number || msg.number || msg.from || msg.contact_number || '',
      );
      if (!contactNumber) return;

      const contactName = String(
        contact.name || contact.firm_name || msg.name || contactNumber,
      );

      let text = String(msg.message || msg.text || msg.body || '');
      const mediaType = msg.media_type || msg.type;

      notificationService.displayMessageNotification(
        contactName,
        text,
        contactNumber,
        mediaType,
      );
    } catch (error) {
      console.warn('Failed to trigger native notification:', error);
    }
  }
}

export const socketManager = new SocketManager();
