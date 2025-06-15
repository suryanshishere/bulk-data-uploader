// src/socket.ts
import http from "http";
import { Server } from "socket.io";
import { createAdapter } from "@socket.io/redis-adapter";
import IORedis from "ioredis";

let io: Server;

export function initSocket(server: http.Server) {
  io = new Server(server, { cors: { origin: "*" } });
  const pub = new IORedis(process.env.REDIS_URL || "redis://localhost:6379");
  const sub = pub.duplicate();
  io.adapter(createAdapter(pub, sub));
  io.on("connection", (socket) => {
    console.log(`🔌 Socket connected: ${socket.id}`);
  });
}

export function getIO() {
  if (!io) {
    io = new Server({ cors: { origin: "*" } });
    const pub = new IORedis(process.env.REDIS_URL || "redis://localhost:6379");
    const sub = pub.duplicate();
    io.adapter(createAdapter(pub, sub));
  }
  return io;
}
