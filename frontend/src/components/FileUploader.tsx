// components/FileUploader.tsx
"use client";

import React, { useState, useEffect, useRef, useReducer } from "react";
import { io, Socket } from "socket.io-client";
import { useRouter } from "next/navigation";
import FileDropZone from "./FileDropZone";
import UploadButton from "./UploadButton";
import ProgressBar from "./ProgressBar";
import Logs from "./Logs";
import UploadHistory from "./UploadHistory";
import { useSocket } from "@hooks/useSocket";
import { useUploader } from "@hooks/useUploader";
import { uploaderReducer } from "lib/uploaderState";

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

const isValidFile = (f: File | null) => f && f.size > 0 && /\.(csv|xlsx)$/i.test(f.name);

interface FileUploaderProps {
  initialEmail: string;
}

export default function FileUploader({ initialEmail }: FileUploaderProps) {
  const [state, dispatch] = useReducer(uploaderReducer, initialState(initialEmail));
  const socketRef = useSocket(state.email, dispatch);
  const { uploadFile } = useUploader(dispatch);

  const {
    selectedFile,
    isUploading,
    uploadProgress,
    processProgress,
    isConnected,
    currentProcessId,
    history,
    logs,
  } = state;

  const handleUpload = () => {
    if (socketRef.current && selectedFile && isValidFile(selectedFile)) {
      uploadFile(selectedFile, state.email);
    } else {
      dispatch({ type: "ADD_LOG", payload: "❌ Select a valid CSV/XLSX file to upload." });
    }
  };

  const isProcessing = !!currentProcessId;
  const canUpload = isConnected && !isUploading && !isProcessing && isValidFile(selectedFile);

  const getStatusText = () => {
    if (isUploading) return `Uploading ${uploadProgress}%...`;
    if (isProcessing) return "Processing in background...";
    if (!isConnected) return "Connecting...";
    return "Upload File";
  };

  const [dragActive, setDragActive] = useState(false);

  return (
    <div className="w-full medium_mobile:w-[25rem] flex flex-col gap-8">
      {/* Loading UI while socket is connecting */}
      {!isConnected && (
        <div className="flex justify-center items-center h-48">
          <div className="w-12 h-12 border-4 border-custom_gray border-t-transparent rounded-full animate-spin"></div>
        </div>
      )}

      {/* Main Uploader UI when connected */}
      {isConnected && (
        <>
          <div className="flex flex-col gap-4">
            <FileDropZone
              onFileSelect={(file) => dispatch({ type: "SET_SELECTED_FILE", payload: file })}
              disabled={!isConnected || isUploading || isProcessing}
              selectedFile={selectedFile}
              dragActive={dragActive}
              setDragActive={setDragActive}
            />
            <UploadButton
              onClick={handleUpload}
              disabled={!canUpload}
              progress={isUploading ? uploadProgress : 0}
              statusText={getStatusText()}
            />
          </div>

          {/* Upload & Process Progress Bars */}
          {isUploading && uploadProgress < 100 && (
            <ProgressBar label="Uploading" progress={uploadProgress} />
          )}
          {isProcessing && processProgress !== null && (
            <ProgressBar label="Processing" progress={processProgress} />
          )}

          {/* Live Logs */}
          <div className="font-mono mt-4">
            <h4>Live Logs</h4>
            <Logs lines={logs} />
          </div>

          {/* History or loading placeholder */}
          {history.length === 0 && !isUploading && !isProcessing ? (
            <div className="flex justify-center items-center h-32 text-gray-500">
              Loading history on availability...
            </div>
          ) : (
            <UploadHistory history={history} currentProcessId={currentProcessId} />
          )}
        </>
      )}
    </div>
  );
}
