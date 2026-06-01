import { useEffect, useRef } from 'react';
import { io } from 'socket.io-client';

let socketInstance = null;

export const useSocket = (room, handlers = {}) => {
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    if (!socketInstance) {
      socketInstance = io('/', { withCredentials: true, transports: ['websocket'] });
    }

    const socket = socketInstance;
    if (room) socket.emit('join-room', room);

    const cleanup = [];
    Object.entries(handlersRef.current).forEach(([event, handler]) => {
      const wrapper = (...args) => handlersRef.current[event]?.(...args);
      socket.on(event, wrapper);
      cleanup.push([event, wrapper]);
    });

    return () => {
      cleanup.forEach(([event, wrapper]) => socket.off(event, wrapper));
    };
  }, [room]);

  return socketInstance;
};
