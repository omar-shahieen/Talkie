import { io, Socket } from 'socket.io-client';
import { API_URL } from './services/api.service';
import { getAccessToken } from './authStorage';

let chatSocket: Socket | null = null;
let notificationsSocket: Socket | null = null;
let heartbeatInterval: ReturnType<typeof setInterval> | null = null;

function startHeartbeat(socket: Socket) {
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
  }

  heartbeatInterval = setInterval(() => {
    if (socket.connected) {
      socket.emit('presence:heartbeat');
    }
  }, 30000); // 30 seconds
}

export function getChatSocket(): Socket | null {
  const accessToken = getAccessToken();
  if (!accessToken) {
    if (chatSocket) {
      chatSocket.disconnect();
      chatSocket = null;
    }
    return null;
  }

  if (chatSocket) {
    const currentToken = (chatSocket.auth as { token?: string } | undefined)
      ?.token;
    if (currentToken === accessToken) {
      return chatSocket;
    }
    chatSocket.disconnect();
  }

  chatSocket = io(`${API_URL}/chat`, {
    autoConnect: true,
    transports: ['websocket'],
    withCredentials: true,
    auth: { token: accessToken },
  });

  chatSocket.on('connect', () => {
    console.log('[Socket] Connected to /chat namespace');
  });

  chatSocket.on('disconnect', (reason) => {
    console.warn('[Socket] Disconnected from /chat namespace:', reason);
  });

  chatSocket.on('connect_error', (error) => {
    console.error('[Socket] Connection error on /chat namespace:', error);
  });

  startHeartbeat(chatSocket);

  return chatSocket;
}

export function getNotificationsSocket(): Socket | null {
  const accessToken = getAccessToken();
  if (!accessToken) {
    if (notificationsSocket) {
      notificationsSocket.disconnect();
      notificationsSocket = null;
    }
    return null;
  }

  if (notificationsSocket) {
    const currentToken = (
      notificationsSocket.auth as { token?: string } | undefined
    )?.token;
    if (currentToken === accessToken) {
      return notificationsSocket;
    }
    notificationsSocket.disconnect();
  }

  notificationsSocket = io(`${API_URL}/notifications`, {
    autoConnect: true,
    transports: ['websocket'],
    withCredentials: true,
    auth: { token: accessToken },
  });

  return notificationsSocket;
}

export function disconnectSockets(): void {
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
    heartbeatInterval = null;
  }
  if (chatSocket) {
    chatSocket.disconnect();
    chatSocket = null;
  }
  if (notificationsSocket) {
    notificationsSocket.disconnect();
    notificationsSocket = null;
  }
}
