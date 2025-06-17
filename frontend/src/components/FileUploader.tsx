"use client";

import React, { useState, useEffect, useRef, ChangeEvent } from "react";
import { io, Socket } from "socket.io-client";
import FileDropZone from "./FileDropZone";
import UploadButton from "./UploadButton";
import ProgressBar from "./ProgressBar";
import Logs from "./Logs";
import { Input } from "./Input";

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

type State = {
  email: string;
  emailSubmitted: boolean;
  history: HistoryEntry[];
  currentProcessId: string | null;
  uploadProgress: number;
  processProgress: number | null;
  logs: string[];
  isConnected: boolean;
  isUploading: boolean;
  selectedFile: File | null;
};

const initialState: State = {
  email: "",
  emailSubmitted: false,
  history: [],
  currentProcessId: null,
  uploadProgress: 0,
  processProgress: null,
  logs: [],
  isConnected: false,
  isUploading: false,
  selectedFile: null,
};

const isValidEmail = (email: string) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
const isValidFile = (f: File | null) =>
  Boolean(f && f.size > 0 && /\.(csv|xlsx)$/i.test(f.name));

export default function FileUploader() {
  const [state, setState] = useState(initialState);
  const socketRef = useRef<Socket | null>(null);

  const addLog = (msg: string, extra: Partial<State> = {}) => {
    const timestamp = new Date().toLocaleTimeString();
    setState((s) => ({
      ...s,
      logs: [...s.logs, `${timestamp}: ${msg}`],
      ...extra,
    }));
  };

  useEffect(() => {
    if (!state.emailSubmitted) return;

    const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL!;
    const socket = io(BACKEND, {
      query: { email: state.email },
      transports: ["websocket", "polling"],
      path: "/socket.io",
    });
    socketRef.current = socket;

    socket.on("connect", () =>
      addLog(`✅ Socket connected (${socket.id})`, { isConnected: true })
    );
    socket.on("history", (hist: HistoryEntry[]) => {
      setState((s) => {
        const curr = hist.find((h) => h.status === "processing")?._id || null;
        return {
          ...s,
          history: hist,
          currentProcessId: curr,
          processProgress: curr !== s.currentProcessId ? 0 : s.processProgress,
        };
      });
      addLog(`📜 Loaded full history (${state.history.length + 1})`);
    });
    socket.on("fileProcessId", (pid: string) =>
      setState((s) => ({ ...s, currentProcessId: pid }))
    );
    socket.on(
      "progress",
      ({ processId, percent }: { processId: string; percent: number }) => {
        setState((s) => {
          if (s.currentProcessId !== processId) return s;
          return {
            ...s,
            logs: [
              ...s.logs,
              `${new Date().toLocaleTimeString()}: 📊 Processing: ${percent}%`,
            ],
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
      socket.disconnect();
      socketRef.current = null;
    };
  }, [state.emailSubmitted]);

  const submitEmail = () => {
    if (!isValidEmail(state.email)) {
      addLog("❌ Please enter a valid email");
      return;
    }
    setState((s) => ({ ...s, emailSubmitted: true, logs: [] }));
  };

  const uploadFile = () => {
    if (!socketRef.current || !state.isConnected) {
      return addLog("❌ Not connected");
    }
    if (!isValidFile(state.selectedFile)) {
      return addLog("❌ Select a non‑empty .csv or .xlsx");
    }
    setState((s) => ({
      ...s,
      isUploading: true,
      uploadProgress: 0,
      processProgress: 0,
      logs: [],
    }));

    const form = new FormData();
    form.append("file", state.selectedFile!);
    form.append("socketId", socketRef.current.id ?? "");
    form.append("email", state.email);

    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/upload`);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        const p = Math.round((e.loaded / e.total) * 100);
        addLog(`📤 Upload: ${p}%`, { uploadProgress: p });
      }
    };
    xhr.onload = () => {
      if (xhr.status === 200) {
        addLog("✔️ Upload complete, waiting for processing…");
      } else {
        addLog(`❌ Upload failed (${xhr.status})`, { isUploading: false });
      }
    };
    xhr.onerror = () =>
      addLog("❌ Network error during upload", { isUploading: false });
    xhr.send(form);
  };

  const isProcessing =
    !!state.currentProcessId &&
    !!state.history.find((h) => h._id === state.currentProcessId);

  const canUpload =
    state.isConnected &&
    state.emailSubmitted &&
    !state.isUploading &&
    isValidEmail(state.email) &&
    isValidFile(state.selectedFile);

  const uploadLabel = state.isUploading
    ? state.uploadProgress < 100
      ? `Uploading ${state.uploadProgress}%`
      : "Uploaded"
    : isProcessing
    ? "Upload Another File"
    : "Upload File";

  return (
    <div className="w-88 mt-10 flex flex-col gap-6">
      {!state.emailSubmitted ? (
        <>
          <Input
            name="email"
            label="Enter your email to continue"
            type="email"
            required
            placeholder="you@example.com"
            value={state.email}
            onChange={(e: ChangeEvent<HTMLInputElement>) =>
              setState((s) => ({ ...s, email: e.target.value }))
            }
            error={state.email.length > 0 && !isValidEmail(state.email)}
            helperText="We'll use this to fetch your upload history"
          />
          <button
            onClick={submitEmail}
            disabled={!isValidEmail(state.email)}
            className={`w-full h-10 font-semibold rounded ${
              !isValidEmail(state.email)
                ? "bg-gray-400 cursor-not-allowed"
                : "bg-green-600 hover:bg-green-700"
            } text-white`}
          >
            Submit Email
          </button>
        </>
      ) : (
        <>
          <FileDropZone
            onFileSelect={(file) =>
              setState((s) => ({ ...s, selectedFile: file }))
            }
            disabled={!state.isConnected || state.isUploading}
            selectedFile={state.selectedFile}
            dragActive={false}
            setDragActive={() => {}}
          />

          <UploadButton
            onClick={uploadFile}
            disabled={!canUpload}
            progress={state.uploadProgress}
            statusText={uploadLabel}
          />

          {!state.isUploading && isProcessing && (
            <ProgressBar label="Processing" progress={state.processProgress!} />
          )}

          {!state.isUploading && isProcessing && (
            <div className="font-mono mt-4">
              <h4>Logs</h4>
              <Logs lines={state.logs} />
            </div>
          )}

          <div className="flex flex-col gap-1">
            <h4 className="text-lg font-semibold">Previous uploads</h4>
            <ul className="space-y-2 mb-4">
              {state.history.length > 0 ? (
                state.history.map((h) => (
                  <li key={h._id} className="flex justify-between">
                    <span>
                      {new Date(h.createdAt).toLocaleString()} •{" "}
                      <span className="font-mono text-sm text-gray-500">
                        ID: {h._id}
                      </span>
                    </span>
                    <span>
                      {h._id === state.currentProcessId
                        ? "processing"
                        : h.status}
                    </span>
                  </li>
                ))
              ) : (
                <li>No upload history yet.</li>
              )}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}
