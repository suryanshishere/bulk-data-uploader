// components/FileUploader.tsx
"use client";

import React, { useState, useEffect, useRef } from "react";
import { io, Socket } from "socket.io-client";
import { useRouter } from "next/navigation";
import FileDropZone from "./FileDropZone";
import UploadButton from "./UploadButton";
import ProgressBar from "./ProgressBar";
import Logs from "./Logs";
import UploadHistory from "./UploadHistory";

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
  createdAt: string; // ISO string
  updatedAt: string;
};

type State = {
  // email is provided once; we keep it in state for sending to backend
  email: string;
  history: HistoryEntry[];
  currentProcessId: string | null;
  uploadProgress: number;
  processProgress: number | null;
  logs: string[];
  isConnected: boolean;
  isUploading: boolean;
  selectedFile: File | null;
};

const initialState = (initialEmail: string): State => ({
  email: initialEmail,
  history: [],
  currentProcessId: null,
  uploadProgress: 0,
  processProgress: null,
  logs: [],
  isConnected: false,
  isUploading: false,
  selectedFile: null,
});

const isValidFile = (f: File | null) =>
  Boolean(f && f.size > 0 && /\.(csv|xlsx)$/i.test(f.name));

interface FileUploaderProps {
  initialEmail: string;
}

export default function FileUploader({ initialEmail }: FileUploaderProps) {
  const router = useRouter();

  // Initialize state with the guaranteed email
  const [state, setState] = useState<State>(() => initialState(initialEmail));
  const socketRef = useRef<Socket | null>(null);

  // Helper to add a log entry, optionally merging extra state fields.
  const addLog = (msg: string, extra: Partial<State> = {}) => {
    const timestamp = new Date().toLocaleTimeString();
    setState((s) => {
      // Optionally limit log length, e.g., keep last 200 entries
      const newLogs =
        s.logs.length >= 200
          ? [...s.logs.slice(s.logs.length - 199), `${timestamp}: ${msg}`]
          : [...s.logs, `${timestamp}: ${msg}`];
      return {
        ...s,
        logs: newLogs,
        ...extra,
      };
    });
  };

  const {
    email,
    isConnected,
    selectedFile,
    isUploading,
    currentProcessId,
    history,
    uploadProgress,
    processProgress,
  } = state;

  // Connect on mount using initialEmail
  useEffect(() => {
    const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL;
    if (!BACKEND) {
      addLog("❌ NEXT_PUBLIC_BACKEND_URL is not defined in environment.");
      return;
    }

    const socket = io(BACKEND, {
      query: { email: email.trim() },
      transports: ["websocket", "polling"],
      path: "/socket.io",
    });
    socketRef.current = socket;

    socket.on("connect", () => {
      addLog(`✅ Socket connected (${socket.id})`, { isConnected: true });
    });

    socket.on("history", (histPayload: any) => {
      console.log("history payload:", histPayload);
      let entries: HistoryEntry[] | null = null;
      if (Array.isArray(histPayload)) {
        entries = histPayload;
      } else if (histPayload && Array.isArray((histPayload as any).history)) {
        entries = (histPayload as any).history as HistoryEntry[];
      } else {
        console.error("Unexpected history payload format:", histPayload);
        addLog("❌ Unexpected history format received from server");
        return;
      }

      setState((s) => {
        const curr =
          entries!.find((h) => h.status === "processing")?._id || null;
        const resetProcessProgress =
          curr !== s.currentProcessId ? 0 : s.processProgress;
        return {
          ...s,
          history: entries!,
          currentProcessId: curr,
          processProgress: resetProcessProgress,
        };
      });
      addLog(
        `📜 Loaded full history (${entries.length} entr${
          entries.length === 1 ? "y" : "ies"
        })`
      );
    });

    socket.on("fileProcessId", (pid: string) => {
      setState((s) => ({ ...s, currentProcessId: pid }));
    });

    socket.on(
      "progress",
      ({ processId, percent }: { processId: string; percent: number }) => {
        setState((s) => {
          if (s.currentProcessId !== processId) return s;
          const timestamp = new Date().toLocaleTimeString();
          const newLogs = [
            ...s.logs,
            `${timestamp}: 📊 Processing: ${percent}%`,
          ];
          return {
            ...s,
            logs: newLogs,
            processProgress: percent,
          };
        });
      }
    );

    socket.on("summary", (sum: Summary & { processId: string }) => {
      addLog(
        `📑 Summary: ${sum.success}/${sum.total} succeeded, ${sum.failed} failed`
      );
      setState((s) => ({
        ...s,
        processProgress: 100,
        isUploading: false,
        currentProcessId: null,
      }));
    });

    socket.on("log", (m: string) => addLog(`🔧 ${m}`));

    socket.on("disconnect", () =>
      addLog("🔌 Socket disconnected", { isConnected: false })
    );
    socket.on("error", (e: any) => addLog(`❌ Socket error: ${e}`));

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
    // Only run once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const uploadFile = () => {
    if (!socketRef.current || !isConnected) {
      addLog("❌ Not connected to server. Please wait for connection.");
      return;
    }
    if (!isValidFile(selectedFile)) {
      addLog("❌ Select a non‑empty .csv or .xlsx file");
      return;
    }

    setState((s) => ({
      ...s,
      isUploading: true,
      uploadProgress: 0,
      processProgress: 0,
      logs: [], // clear logs for this upload cycle
    }));

    const form = new FormData();
    form.append("file", selectedFile!);
    form.append("socketId", socketRef.current!.id ?? "");
    form.append("email", email.trim());

    const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL;
    if (!BACKEND) {
      addLog("❌ NEXT_PUBLIC_BACKEND_URL is not defined");
      setState((s) => ({ ...s, isUploading: false }));
      return;
    }

    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${BACKEND}/api/upload`);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        const p = Math.round((e.loaded / e.total) * 100);
        addLog(`📤 Upload: ${p}%`, { uploadProgress: p });
      }
    };
    xhr.onload = () => {
      if (xhr.status === 200) {
        addLog("✔️ Upload complete, waiting for processing…");
        // Automatically refresh the page (Next.js App Router) to revalidate data
        router.refresh();
      } else {
        addLog(`❌ Upload failed (${xhr.status})`, { isUploading: false });
      }
    };
    xhr.onerror = () => {
      addLog("❌ Network error during upload", { isUploading: false });
    };
    xhr.send(form);
  };

  const isProcessing =
    !!currentProcessId && !!history.find((h) => h._id === currentProcessId);

  const canUpload = isConnected && !isUploading && isValidFile(selectedFile);

  const uploadLabel = isUploading
    ? uploadProgress < 100
      ? `Uploading ${uploadProgress}%`
      : "Uploaded"
    : isProcessing
    ? "Upload Another File"
    : "Upload File";

  return (
    <div className="w-full medium_mobile:w-[25rem] flex flex-col gap-12">
      {/* FileDropZone and UploadButton */}
      {!isUploading && !isProcessing && processProgress === null ? (
        <div className="flex flex-col gap-4">
          <FileDropZone
            onFileSelect={(file) =>
              setState((s) => ({ ...s, selectedFile: file }))
            }
            disabled={!isConnected || isUploading}
            selectedFile={selectedFile}
            dragActive={false}
            setDragActive={() => {}}
          />

          <UploadButton
            onClick={uploadFile}
            disabled={!canUpload}
            progress={uploadProgress}
            statusText={uploadLabel}
          />
        </div>
      ) : processProgress !== null ? (
        <ProgressBar label="Processing" progress={processProgress} />
      ) : null}

      {/* Logs */}
      {!isUploading && isProcessing && (
        <div className="font-mono mt-4">
          <h4>Logs</h4>
          <Logs lines={state.logs} />
        </div>
      )}

      {/* Upload history */}
      <UploadHistory history={history} currentProcessId={currentProcessId} />
    </div>
  );
}
