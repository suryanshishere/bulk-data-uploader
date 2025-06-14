// socket.ts
import { Server } from 'socket.io';

let io: Server;

export function initSocket(server: any) {
  io = new Server(server, {
    cors: { origin: "*" },
    path: "/socket.io", // Important!
  });

  io.on("connection", (socket) => {
    console.log("✅ Client connected:", socket.id);
    socket.join(socket.id); // 🧠 We use socket.id as room name
  });

  return io;
}

export { io };
