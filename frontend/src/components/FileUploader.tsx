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

type State = {
  uploadProgress: number;
  processProgress: number | null;
  logs: string[];
  isConnected: boolean;
  isUploading: boolean;
  dragActive: boolean;
  selectedFile: File | null;
  email: string;
};

const initialState: State = {
  uploadProgress: 0,
  processProgress: null,
  logs: [],
  isConnected: false,
  isUploading: false,
  dragActive: false,
  selectedFile: null,
  email: "",
};

// Email validation function
const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email.trim());
};

// File validation function
const isValidFile = (file: File | null): boolean => {
  if (!file) return false;
  if (file.size === 0) return false;
  const validExtensions = /\.(csv|xlsx)$/i;
  return validExtensions.test(file.name);
};

export default function FileUploader() {
  const [state, setState] = useState<State>(initialState);
  const socketRef = useRef<Socket | null>(null);

  const handleLog = (message: string, updates: Partial<State> = {}) => {
    const timestamp = new Date().toLocaleTimeString();
    const logEntry = `${timestamp}: ${message}`;
    setState((prev) => ({
      ...prev,
      logs: [...prev.logs, logEntry],
      ...updates,
    }));
  };

  const handleSummary = (summary: Summary) => {
    handleLog(
      `📑 Summary — total: ${summary.total}, success: ${summary.success}, failed: ${summary.failed}`
    );
    if (summary.errors.length > 0) {
      const errorMessages = summary.errors
        .map((e) => `Row ${e.row}: ${e.message}`)
        .join("; ");
      handleLog(`⚠️ Errors: ${errorMessages}`);
    }
    setState((prev) => ({ ...prev, processProgress: 100 }));
  };

  const resetState = () => {
    setState((prev) => ({
      ...prev,
      logs: [],
      uploadProgress: 0,
      processProgress: null,
    }));
  };

  useEffect(() => {
    const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL!;
    const socket = io(BACKEND_URL, {
      transports: ["websocket", "polling"],
      path: "/socket.io",
    });
    socketRef.current = socket;

    socket.on("connect", () =>
      handleLog(`✅ Socket connected (${socket.id})`, { isConnected: true })
    );
    socket.on("log", (msg: string) => handleLog(`🔧 ${msg}`));
    socket.on("progress", (pct: number) =>
      handleLog(`📊 Processing: ${pct}%`, { processProgress: pct })
    );
    socket.on("summary", handleSummary);
    socket.on("disconnect", () =>
      handleLog("🔌 Disconnected from server", { isConnected: false })
    );
    socket.on("error", (err: any) => handleLog(`❌ Socket error: ${err}`));

    return () => {
      socket.disconnect();
    };
  }, []);

  const uploadFile = () => {
    const { selectedFile, isConnected, email } = state;

    if (!isValidEmail(email)) {
      return handleLog("❌ Please enter a valid email address.");
    }

    if (!isValidFile(selectedFile)) {
      if (!selectedFile) {
        return handleLog("❌ No file selected. Please choose a file to upload.");
      }
      if (selectedFile.size === 0) {
        return handleLog("❌ Selected file is empty.");
      }
      return handleLog("❌ Invalid file type. Only .csv or .xlsx files are allowed.");
    }

    if (!socketRef.current || !isConnected) {
      return handleLog("❌ Not connected to server.");
    }

    // At this point, we know selectedFile is not null due to isValidFile check
    const validatedFile = selectedFile!;

    resetState();
    setState((prev) => ({ ...prev, isUploading: true }));

    const formData = new FormData();
    formData.append("file", validatedFile);
    formData.append("socketId", socketRef.current.id ?? "");
    formData.append("email", email);

    handleLog("📁 Starting upload…");

    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/upload`);

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        const pct = Math.round((event.loaded / event.total) * 100);
        handleLog(`📤 Upload: ${pct}%`, { uploadProgress: pct });
      }
    };

    xhr.onload = () => {
      if (xhr.status === 200) {
        handleLog("✔️ Upload complete, awaiting processing…", {
          uploadProgress: 100,
          processProgress: 0,
        });
      } else {
        handleLog(`❌ Upload failed: ${xhr.status} ${xhr.statusText}`, {
          isUploading: false,
        });
      }
    };

    xhr.onerror = () =>
      handleLog("❌ Network error during upload", { isUploading: false });

    xhr.send(formData);
  };

  useEffect(() => {
    if (state.processProgress === 100) {
      const timeout = setTimeout(() => {
        setState((prev) => ({
          ...prev,
          isUploading: false,
          selectedFile: null,
        }));
        handleLog("🔄 Ready for next upload.");
      }, 1500);
      return () => clearTimeout(timeout);
    }
  }, [state.processProgress]);

  // Enhanced validation for upload button
  const isUploadReady = 
    state.isConnected && 
    !state.isUploading && 
    isValidEmail(state.email) && 
    isValidFile(state.selectedFile);

  const statusText = !state.isConnected
    ? "Connecting…"
    : state.isUploading
    ? state.uploadProgress < 100
      ? `Uploading ${state.uploadProgress}%`
      : "Uploaded"
    : isUploadReady
    ? "Ready to upload"
    : "Upload";

  const handleEmailChange = (e: ChangeEvent<HTMLInputElement>) => {
    setState((prev) => ({ ...prev, email: e.target.value }));
  };

  // Enhanced error checking for email input
  const emailError = state.email.length > 0 && !isValidEmail(state.email);
  const showEmailValidationError = 
    state.logs.some((l) => l.includes("Please enter a valid email"));

  return (
    <div className="w-88 mt-10 flex flex-col gap-8">
      <FileDropZone
        onFileSelect={(file) =>
          setState((prev) => ({ ...prev, selectedFile: file }))
        }
        disabled={!state.isConnected || state.isUploading}
        selectedFile={state.selectedFile}
        dragActive={state.dragActive}
        setDragActive={(active) =>
          setState((prev) => ({ ...prev, dragActive: active }))
        }
      />

      <Input
        name="email"
        label="Email"
        type="email"
        required
        placeholder="you@example.com"
        value={state.email}
        onChange={handleEmailChange}
        error={emailError || showEmailValidationError}
        helperText={
          emailError 
            ? "Please enter a valid email address" 
            : isValidEmail(state.email) 
            ? "Valid email address" 
            : "Please enter a valid email address"
        }
      />

      <UploadButton
        onClick={uploadFile}
        disabled={!isUploadReady}
        progress={state.uploadProgress}
        statusText={statusText}
      />

      {state.isUploading && state.uploadProgress < 100 && (
        <ProgressBar label="Upload Progress" progress={state.uploadProgress} />
      )}

      {state.processProgress !== null && (
        <ProgressBar
          label="Processing Progress"
          progress={state.processProgress}
        />
      )}

      <div className="font-mono">
        <h3>Real time log</h3>
        <Logs lines={state.logs} />
      </div>
    </div>
  );
}