// src/socket.ts
import { Server } from "socket.io";
import { createAdapter } from "@socket.io/redis-adapter";
import { createClient } from "redis";
import { FileProcess } from "./models/FileProcess";

let io: Server;

export const initSocket = async (server: any) => {
  io = new Server(server, {
    cors: {
      origin: "*",
    },
  });

  const pubClient = createClient({ url: process.env.REDIS_URL });
  const subClient = pubClient.duplicate();
  await pubClient.connect();
  await subClient.connect();
  io.adapter(createAdapter(pubClient, subClient));

  io.on("connection", async (socket) => {
    const email = socket.handshake.query.email as string;

    if (email) {
      socket.join(email); // Join user's email room

      await sendHistoryAndCurrentProcess(email, socket);
    }

    socket.on("requestHistory", async ({ email }) => {
      await sendHistoryAndCurrentProcess(email, socket);
    });

    socket.on("joinProcessRoom", ({ pid }) => {
      socket.join(pid); // Join process ID room to receive batch updates
    });
  });
};

// Shared logic to emit history and progress
async function sendHistoryAndCurrentProcess(email: string, socket: any) {
  const history = await FileProcess.find({ userEmail: email }).sort({
    createdAt: -1,
  });

  const current = await FileProcess.findOne({
    userEmail: email,
    status: "processing",
  });

  socket.emit("history", {
    list: history,
    currentProcessingId: current?._id.toString() ?? null,
  });

  if (current) {
    const percent = Math.round((current.processed / current.total) * 100);
    socket.emit("fileProcessId", current._id.toString());
    socket.emit("progress", {
      processId: current._id.toString(),
      percent,
    });
  }
}

export const getIO = () => io;
