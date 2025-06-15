"use client";

import { useState, useRef, useEffect } from "react";
import { io, Socket } from "socket.io-client";

type Summary = {
  total: number;
  success: number;
  failed: number;
  errors: { row: number; message: string }[];
};

export default function FileUploader() {
  const [uploadProgress, setUploadProgress] = useState(0);
  const [processProgress, setProcessProgress] = useState<number | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [isConnected, setIsConnected] = useState(false);

  const fileInput = useRef<HTMLInputElement>(null);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL;
    if (!BACKEND_URL) {
      console.error("NEXT_PUBLIC_BACKEND_URL is not defined");
      return;
    }

    const socket = io(BACKEND_URL, {
      transports: ["websocket", "polling"],
      path: "/socket.io",
    });
    socketRef.current = socket;

    socket.on("connect", () => {
      setIsConnected(true);
      appendLog(`✅ Socket connected (${socket.id})`);
    });

    // catch worker log messages
    socket.on("log", (msg: string) => {
      appendLog(`🔧 ${msg}`);
    });

    socket.on("progress", (pct: number) => {
      setProcessProgress(pct);
      appendLog(`📊 Processing: ${pct}%`);
    });

    socket.on("summary", (summary: Summary) => {
      appendLog(
        `📑 Summary — total: ${summary.total}, success: ${summary.success}, failed: ${summary.failed}`
      );
      if (summary.errors.length) {
        appendLog(
          `⚠️ Errors:\n${summary.errors
            .map((e) => `Row ${e.row}: ${e.message}`)
            .join("\n")}`
        );
      }
      setProcessProgress(100);
    });

    socket.on("disconnect", () => {
      setIsConnected(false);
      appendLog("🔌 Disconnected from server");
    });

    socket.on("error", (err: any) => {
      appendLog(`❌ Socket error: ${err}`);
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  const appendLog = (msg: string) => {
    setLogs((logs) => [...logs, `${new Date().toLocaleTimeString()}: ${msg}`]);
  };

  const upload = () => {
    const file = fileInput.current?.files?.[0];
    const socket = socketRef.current;
    if (!file) return alert("Please select a file first.");
    if (!socket || !isConnected) return alert("Socket not connected.");

    // reset
    setUploadProgress(0);
    setProcessProgress(null);
    setLogs([]);

    const sid = socket.id;
    if (!sid) return alert("Socket still connecting, please wait.");

    const fd = new FormData();
    fd.append("file", file);
    fd.append("socketId", sid);

    appendLog("📁 Starting upload…");
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/upload`);

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        const pct = Math.round((e.loaded / e.total) * 100);
        setUploadProgress(pct);
        appendLog(`📤 Upload: ${pct}%`);
      }
    };

    xhr.onload = () => {
      if (xhr.status === 200) {
        appendLog("✔️ Upload complete, awaiting processing…");
      } else {
        appendLog(`❌ Upload failed: ${xhr.statusText}`);
        alert("Upload failed on server");
      }
    };

    xhr.onerror = () => {
      appendLog("❌ Network error during upload");
      alert("Network error during upload");
    };

    xhr.send(fd);
  };

  return (
    <div className="max-w-md mx-auto mt-10 space-y-4">
      <input
        type="file"
        ref={fileInput}
        accept=".csv,.xlsx"
        className="block w-full text-sm text-gray-700"
      />

      <button
        onClick={upload}
        disabled={!isConnected}
        className={`w-full py-2 font-semibold text-white rounded ${
          isConnected
            ? "bg-blue-600 hover:bg-blue-700"
            : "bg-gray-400 cursor-not-allowed"
        }`}>
        {isConnected ? "Upload" : "Connecting…"}
      </button>

      {/* Upload Progress */}
      <div>
        <p className="text-sm text-gray-600">Upload Progress</p>
        <div className="w-full h-4 bg-gray-200 rounded">
          <div
            className="h-4 bg-green-500 rounded transition-width duration-200"
            style={{ width: `${uploadProgress}%` }}
          />
        </div>
        <p className="text-right text-sm text-gray-600">{uploadProgress}%</p>
      </div>

      {/* Processing Progress */}
      {processProgress !== null && (
        <div>
          <p className="text-sm text-gray-600">Processing Progress</p>
          <div className="w-full h-4 bg-gray-200 rounded">
            <div
              className="h-4 bg-blue-500 rounded transition-width duration-200"
              style={{ width: `${processProgress}%` }}
            />
          </div>
          <p className="text-right text-sm text-gray-600">{processProgress}%</p>
        </div>
      )}

      {/* Logs */}
      <div className="h-40 overflow-y-auto bg-gray-50 p-2 rounded border">
        {logs.map((line, i) => (
          <div key={i} className="text-xs font-mono text-gray-700">
            {line}
          </div>
        ))}
      </div>
    </div>
  );
}
