"use client";

import { useState, useRef, useEffect } from "react";
import { io, Socket } from "socket.io-client";

export default function FileUploader() {
  const [progress, setProgress] = useState(0);
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
      console.log("✅ Socket connected with id", socket.id);
    });

    socket.on("progress", (pct: number) => {
      console.log("📊 Processing progress:", pct);
      setProgress(pct);
    });

    socket.on("complete", () => {
      console.log("✅ Processing complete");
      alert("Upload and processing complete!");
      setProgress(100);
    });

    socket.on("disconnect", () => {
      setIsConnected(false);
      console.log("🔌 Disconnected from server");
    });

    socket.on("connect_error", (err) => {
      console.error("❌ Socket connection error:", err.message);
      setIsConnected(false);
    });

    // For debugging: log any incoming event
    socket.onAny((event, ...args) => {
      console.log("🔔 Received event:", event, args);
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  const upload = () => {
    const file = fileInput.current?.files?.[0];
    const socket = socketRef.current;

    if (!file) {
      alert("Please select a file before uploading.");
      return;
    }
    if (!socket || !isConnected) {
      alert("Socket not connected. Please wait.");
      return;
    }

    const fd = new FormData();
    fd.append("file", file);
    fd.append("socketId", socket.id ?? "");

    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/upload`);

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        const percent = Math.round((event.loaded / event.total) * 100);
        console.log("📤 Uploading progress:", percent);
        setProgress(percent);
      }
    };

    xhr.onload = () => {
      if (xhr.status !== 200) {
        console.error("Upload failed:", xhr.statusText);
        alert("Upload failed on server");
      } else {
        console.log("✔️ Upload complete, waiting for processing...");
        setProgress(0);
      }
    };

    xhr.onerror = () => {
      console.error("Network error during upload");
      alert("Network error during upload");
    };

    xhr.send(fd);
  };

  return (
    <div className="max-w-md mx-auto mt-10">
      <input
        type="file"
        ref={fileInput}
        accept=".csv,.xlsx"
        className="block w-full text-sm text-gray-700"
      />
      <button
        onClick={upload}
        disabled={!isConnected}
        className={`mt-4 w-full py-2 text-white font-semibold rounded transition 
          ${isConnected ? 'bg-blue-600 hover:bg-blue-700' : 'bg-gray-400 cursor-not-allowed'}`}
      >
        {isConnected ? 'Upload' : 'Connecting...'}
      </button>

      <div className="w-full bg-gray-200 h-4 rounded mt-4">
        <div
          className="h-4 bg-green-500 rounded transition-width duration-200"
          style={{ width: `${progress}%` }}
        />
      </div>
      <p className="mt-1 text-right text-sm text-gray-600">
        {progress}%
      </p>
    </div>
  );
}
