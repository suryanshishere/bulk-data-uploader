// components/UploadHistory.tsx
"use client";

import React from "react";
import Link from "next/link";

// If you have a shared type, import it; otherwise this definition should match:
export interface HistoryEntry {
  _id: string;
  status: string;
  total: number;
  processed: number;
  success: number;
  failed: number;
  createdAt: string; // ISO string
  updatedAt: string;
}

interface UploadHistoryProps {
  history: HistoryEntry[];
  currentProcessId: string | null;
}

export default function UploadHistory({
  history,
  currentProcessId,
}: UploadHistoryProps) {
  return (
    <div className="w-full flex flex-col gap-1">
      <h4 className="text-lg font-semibold">Previous uploads</h4>
      <ul className="w-full space-y-0 mb-4">
        {history.length > 0 ? (
          history.map((h, idx) => (
            <React.Fragment key={h._id}>
              <li className="w-full flex flex-col py-2">
                <div className="flex justify-between w-full">
                  <span> {new Date(h.createdAt).toLocaleString()}</span>
                  <span>
                    {h._id === currentProcessId ? "processing" : h.status}
                  </span>
                </div>
                <div className="w-full flex gap-1 justify-between flex-wrap">
                  <span>So far Processed:</span>
                  <Link
                    href={`/file/${h._id}`}
                    className="cursor-pointer text-custom_blue"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {h._id}
                  </Link>
                </div>
              </li>
              {/* Insert <hr> after each item except the last */}
              {idx < history.length - 1 && (
                <hr className="border-t border-gray-200" />
              )}
            </React.Fragment>
          ))
        ) : (
          <li className="py-2">No upload history yet.</li>
        )}
      </ul>
    </div>
  );
}
