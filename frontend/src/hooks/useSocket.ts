import { useState, useEffect, useRef } from "react";
import { io, Socket } from "socket.io-client";

type Summary = {
  total: number;
  success: number;
  failed: number;
  errors: { row: number; message: string }[];
};

type HistoryEntry = {
  _id: string;
  status: string;
  total: number;
  processed: number;
  success: number;
  failed: number;
  createdAt: string;
  updatedAt: string;
};

type UseSocketOptions = {
  email: string;
  onLog?: (msg: string) => void;
  onHistory?: (history: HistoryEntry[]) => void;
  onProgress?: (processId: string, percent: number) => void;
  onSummary?: (summary: Summary & { processId: string }) => void;
};

export function useSocket({ email, onLog, onHistory, onProgress, onSummary }: UseSocketOptions) {
  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL;
    if (!BACKEND) {
      onLog?.("❌ NEXT_PUBLIC_BACKEND_URL not defined");
      return;
    }

    const socket = io(BACKEND, {
      query: { email: email.trim() },
      transports: ["websocket", "polling"],
      path: "/socket.io",
    });
    socketRef.current = socket;

    socket.on("connect", () => {
      setIsConnected(true);
      onLog?.(`✅ Socket connected (${socket.id})`);
    });

    socket.on("history", (payload) => {
      let entries: HistoryEntry[] = [];
      if (Array.isArray(payload)) entries = payload;
      else if (payload?.history) entries = payload.history;
      else {
        onLog?.("❌ Unexpected history format");
        return;
      }
      onHistory?.(entries);
    });

    socket.on("progress", ({ processId, percent }) => {
      onProgress?.(processId, percent);
    });

    socket.on("summary", (summary) => {
      onSummary?.(summary);
    });

    socket.on("log", (msg: string) => {
      onLog?.(`🔧 ${msg}`);
    });

    socket.on("disconnect", () => {
      setIsConnected(false);
      onLog?.("🔌 Socket disconnected");
    });
    socket.on("error", (err) => onLog?.(`❌ Socket error: ${err}`));

    return () => {
      socketRef.current?.disconnect();
      socketRef.current = null;
    };
  }, [email, onLog, onHistory, onProgress, onSummary]);

  return { socketRef, isConnected };
}
