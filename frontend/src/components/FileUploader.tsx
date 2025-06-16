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
  const [isUploading, setIsUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

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

  const handleFiles = (files: FileList) => {
    if (!files || files.length === 0) return;
    const file = files[0];
    setSelectedFile(file);
    appendLog(`📁 File selected: ${file.name}`);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      handleFiles(e.target.files);
    }
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (isConnected && !isUploading) {
      setDragActive(true);
    }
  };
  const onDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
  };
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    if (isConnected && !isUploading && e.dataTransfer.files) {
      handleFiles(e.dataTransfer.files);
    }
  };

  const triggerFileSelect = () => {
    if (fileInput.current && !isUploading && isConnected) {
      fileInput.current.click();
    }
  };

  const upload = () => {
    const file = selectedFile;
    const socket = socketRef.current;
    if (!file) return alert("Please select a file first.");
    if (!socket || !isConnected) return alert("Socket not connected.");

    setUploadProgress(0);
    setProcessProgress(null);
    setLogs([]);
    setIsUploading(true);

    const sid = socket.id;
    if (!sid) {
      setIsUploading(false);
      return alert("Socket still connecting, please wait.");
    }

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
        setUploadProgress(100);
      } else {
        appendLog(`❌ Upload failed: ${xhr.statusText}`);
        alert("Upload failed on server");
        setIsUploading(false);
        setUploadProgress(0);
      }
    };

    xhr.onerror = () => {
      appendLog("❌ Network error during upload");
      alert("Network error during upload");
      setIsUploading(false);
      setUploadProgress(0);
    };

    xhr.send(fd);
  };

  useEffect(() => {
    if (processProgress === 100) {
      const t = setTimeout(() => {
        setIsUploading(false);
        setUploadProgress(0);
        setProcessProgress(null);
        setSelectedFile(null);
        appendLog("🔄 Ready for next upload.");
      }, 1500);
      return () => clearTimeout(t);
    }
  }, [processProgress]);

  return (
    <div className="w-full mt-10 flex flex-col gap-6">
      <div
        className={`relative border-2 border-dashed rounded-lg p-6 text-center transition-colors cursor-pointer
          ${!isConnected || isUploading || selectedFile ? 'opacity-80 cursor-not-allowed' : ''}
          ${dragActive ? 'border-custom_blue bg-custom_less_blue' : 'border-custom_gray bg-custom_white'}`}
        onClick={triggerFileSelect}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
      >
        <input
          type="file"
          ref={fileInput}
          accept=".csv,.xlsx"
          disabled={!isConnected || isUploading}
          className="hidden"
          onChange={handleInputChange}
        />
        {!selectedFile && !isUploading && (
          <>
            <p className="text-custom_gray">Drag & drop a file here, or click to select one</p>
            <p className="mt-2 text-sm text-custom_gray">(.csv, .xlsx)</p>
          </>
        )}
        {selectedFile &&   (
          <p className="text-gray-700">Selected: {selectedFile.name}</p>
        )} 
      </div>

      {/* Upload button: unchanged UI from original */}
      <button
        onClick={upload}
        disabled={!isConnected || isUploading}
        className={`relative w-full h-10 font-semibold custom_go flex items-center
          ${isConnected ? "bg-blue-600 hover:bg-blue-700" : "bg-gray-400 cursor-not-allowed"}
          disabled:opacity-80 disabled:cursor-not-allowed text-white
        `}
      >
        {isUploading && (
          <div
            role="progressbar"
            aria-valuenow={uploadProgress}
            aria-valuemin={0}
            aria-valuemax={100}
            className="absolute left-0 top-0 h-full bg-custom_green transition-all duration-200"
            style={{ width: `${uploadProgress}%` }}
          />
        )}
        <span className="relative z-10 w-full text-center">
          {!isConnected
            ? "Connecting…"
            : isUploading
            ? uploadProgress < 100
              ? `Uploading ${uploadProgress}%`
              : "Uploaded"
            : "Upload"}
        </span>
      </button>

      {/* Processing Progress */}
      {processProgress !== null && (
        <div className="w-full">
          <p className="text-sm text-custom_gray">Processing Progress</p>
          <div className="w-full h-4 bg-gray-200 rounded">
            <div
              className="h-4 bg-custom_blue rounded transition-all duration-200"
              style={{ width: `${processProgress}%` }}
            />
          </div>
          <p className="text-right text-sm text-custom_gray">{processProgress}%</p>
        </div>
      )}

      {/* Logs */}
      <div className="h-48 w-full overflow-y-auto bg-custom_black p-2 rounded border">
        {logs.map((line, i) => (
          <div key={i} className="text-xs font-mono text-white whitespace-pre-wrap">
            {line}
          </div>
        ))}
      </div>
    </div>
  );
}
