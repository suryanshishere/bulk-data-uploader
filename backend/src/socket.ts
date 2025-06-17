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
      socket.join(email);

      const history = await FileProcess.find({ userEmail: email }).sort({
        createdAt: -1,
      });
      socket.emit("history", history);

      const current = await FileProcess.findOne({
        userEmail: email,
        status: "processing",
      });

      if (current) {
        socket.emit("fileProcessId", current._id.toString());
        const percent = Math.round((current.processed / current.total) * 100);
        socket.emit("progress", { processId: current._id.toString(), percent });
      }
    }

    socket.on("requestHistory", async ({ email }) => {
      const history = await FileProcess.find({ userEmail: email }).sort({
        createdAt: -1,
      });
      socket.emit("history", history);

      const current = await FileProcess.findOne({
        userEmail: email,
        status: "processing",
      });

      if (current) {
        socket.emit("fileProcessId", current._id.toString());
        const percent = Math.round((current.processed / current.total) * 100);
        socket.emit("progress", { processId: current._id.toString(), percent });
      }
    });
  });
};

export const getIO = () => io;
