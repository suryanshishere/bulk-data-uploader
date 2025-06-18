// src/hooks/useSocket.ts

import { useEffect, useRef } from "react";
import { io, Socket } from "socket.io-client";
import { Action, HistoryEntry, Summary } from "../lib/uploaderState";

export function useSocket(email: string, dispatch: React.Dispatch<Action>) {
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL;
    if (!BACKEND_URL) {
      dispatch({
        type: "ADD_LOG",
        payload: "❌ NEXT_PUBLIC_BACKEND_URL is not defined.",
      });
      return;
    }

    const socket = io(BACKEND_URL, {
      query: { email: email.trim() },
      transports: ["websocket", "polling"],
      path: "/socket.io",
    });
    socketRef.current = socket;

    socket.on("connect", () => {
      dispatch({
        type: "ADD_LOG",
        payload: `✅ Socket connected (${socket.id})`,
      });
      dispatch({ type: "SET_CONNECTED", payload: true });
    });

    socket.on(
      "history",
      (payload: {
        list: HistoryEntry[];
        currentProcessingId: string | null;
      }) => {
        dispatch({
          type: "SET_HISTORY",
          payload: {
            history: payload.list,
            currentProcessId: payload.currentProcessingId,
          },
        });
      }
    );
    socket.on("fileProcessId", (pid: string) =>
      dispatch({ type: "SET_CURRENT_PROCESS_ID", payload: pid })
    );
    socket.on("progress", (data: { processId: string; percent: number }) =>
      dispatch({ type: "UPDATE_PROCESS_PROGRESS", payload: data })
    );
    socket.on("summary", (summary: Summary & { processId: string }) =>
      dispatch({ type: "PROCESS_COMPLETE", payload: summary })
    );
    socket.on("log", (msg: string) =>
      dispatch({ type: "ADD_LOG", payload: `🔧 ${msg}` })
    );
    socket.on("disconnect", () =>
      dispatch({ type: "SET_CONNECTED", payload: false })
    );
    socket.on("error", (e: Error) =>
      dispatch({ type: "ADD_LOG", payload: `❌ Socket error: ${e.message}` })
    );

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [email, dispatch]);

  return socketRef;
}
