import { DependencyList, useEffect, useRef } from 'react';

type SocketLike = {
  on: (event: string, listener: (payload: unknown) => void) => void;
  off: (event: string, listener: (payload: unknown) => void) => void;
};

export function useSocketEvent<TPayload>(
  getSocket: () => SocketLike | null,
  eventName: string,
  handler: (payload: TPayload) => void,
  dependencies: DependencyList = [],
) {
  const handlerRef = useRef(handler);

  useEffect(() => {
    handlerRef.current = handler;
  }, [handler]);

  useEffect(() => {
    const socket = getSocket();
    if (!socket) {
      return;
    }

    const listener = (payload: unknown) => {
      handlerRef.current(payload as TPayload);
    };

    socket.on(eventName, listener);

    return () => {
      socket.off(eventName, listener);
    };
  }, [getSocket, eventName, ...dependencies]);
}
