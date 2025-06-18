// src/lib/uploaderState.ts

export type HistoryEntry = {
  _id: string;
  status: string;
  total: number;
  processed: number;
  success: number;
  failed: number;
  createdAt: string; // ISO string
  updatedAt: string;
};

export type Summary = {
  total: number;
  success: number;
  failed: number;
  errors: { row: number; message: string }[];
};

export type State = {
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

export type Action =
  | { type: "SET_CONNECTED"; payload: boolean }
  | { type: "SET_HISTORY"; payload: { history: HistoryEntry[]; currentProcessId: string | null } }
  | { type: "SET_SELECTED_FILE"; payload: File | null }
  | { type: "START_UPLOAD" }
  | { type: "SET_UPLOAD_PROGRESS"; payload: number }
  | { type: "UPLOAD_SUCCESS" }
  | { type: "UPLOAD_FAILURE"; payload: string }
  | { type: "ADD_LOG"; payload: string }
  | { type: "SET_CURRENT_PROCESS_ID"; payload: string }
  | {
      type: "UPDATE_PROCESS_PROGRESS";
      payload: { processId: string; percent: number };
    }
  | { type: "PROCESS_COMPLETE"; payload: Summary & { processId: string } };

export const initialState = (email: string): State => ({
  email,
  history: [],
  currentProcessId: null,
  uploadProgress: 0,
  processProgress: null,
  logs: [],
  isConnected: false,
  isUploading: false,
  selectedFile: null,
});

const addLog = (logs: string[], msg: string): string[] => {
  const timestamp = new Date().toLocaleTimeString();
  // Keep the last 200 logs to prevent memory issues
  const newLogs =
    logs.length >= 200 ? logs.slice(logs.length - 199) : [...logs];
  newLogs.push(`${timestamp}: ${msg}`);
  return newLogs;
};

export function uploaderReducer(state: State, action: Action): State {
  switch (action.type) {
    case "SET_CONNECTED":
      return { ...state, isConnected: action.payload };

    case "SET_HISTORY": {
      // Expect payload: { history: HistoryEntry[]; currentProcessId: string | null }
      const { history: historyArray, currentProcessId } = action.payload as {
        history: HistoryEntry[];
        currentProcessId: string | null;
      };

      // Optional sanity check
      if (!Array.isArray(historyArray)) {
        console.warn(
          "SET_HISTORY called with non‑array history:",
          action.payload
        );
        return state;
      }

      return {
        ...state,
        history: historyArray,
        currentProcessId
      };
    }

    case "SET_SELECTED_FILE":
      return { ...state, selectedFile: action.payload };

    case "START_UPLOAD":
      return {
        ...state,
        isUploading: true,
        uploadProgress: 0,
        processProgress: 0,
        logs: [], // Clear logs for the new upload cycle
      };

    case "SET_UPLOAD_PROGRESS":
      return {
        ...state,
        uploadProgress: action.payload,
        logs:
          state.uploadProgress !== action.payload
            ? addLog(state.logs, `📤 Upload: ${action.payload}%`)
            : state.logs,
      };

    case "UPLOAD_SUCCESS":
      return {
        ...state,
        logs: addLog(state.logs, "✔️ Upload complete, waiting for processing…"),
      };

    case "UPLOAD_FAILURE":
      return {
        ...state,
        isUploading: false,
        logs: addLog(state.logs, `❌ ${action.payload}`),
      };

    case "ADD_LOG":
      return { ...state, logs: addLog(state.logs, action.payload) };

    case "SET_CURRENT_PROCESS_ID":
      return { ...state, currentProcessId: action.payload };

    case "UPDATE_PROCESS_PROGRESS":
      if (state.currentProcessId !== action.payload.processId) return state;
      return {
        ...state,
        processProgress: action.payload.percent,
        logs: addLog(state.logs, `📊 Processing: ${action.payload.percent}%`),
      };

    case "PROCESS_COMPLETE":
      return {
        ...state,
        isUploading: false, // The entire cycle is now complete
        processProgress: 100,
        currentProcessId: null,
        logs: addLog(
          state.logs,
          `📑 Summary: ${action.payload.success}/${action.payload.total} succeeded, ${action.payload.failed} failed.`
        ),
      };

    default:
      return state;
  }
}
