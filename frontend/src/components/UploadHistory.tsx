"use client";

import React from "react";
import Link from "next/link";

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
    <div className="w-full flex flex-col gap-2">
      <h4 className="text-lg font-semibold">Previous uploads</h4>

      {history.length === 0 ? (
        <div className="py-4 text-gray-500">No upload history yet.</div>
      ) : (
        <ul className="space-y-4">
          {history.map((h, idx) => {
            const isCurrent = h._id === currentProcessId;
            const statusLabel = isCurrent
              ? "Processing"
              : h.status.charAt(0).toUpperCase() + h.status.slice(1);

            return (
              <React.Fragment key={h._id}>
                <li className="flex flex-col gap-1">
                  {/* Row 1: timestamp and status */}
                  <div className="flex justify-between items-center">
                    <time className="text-xs text-custom_gray">
                      {new Date(h.createdAt).toLocaleString()}
                    </time>
                    <span
                      className={
                        "font-medium " +
                        (h.status === "failed"
                          ? "text-custom_red"
                          : h.status === "completed"
                          ? "text-custom_green"
                          : "text-custom_pale_orange")
                      }
                    >
                      {statusLabel}
                    </span>
                  </div>

                  {/* Row 2: stats */}
                  <div className="flex flex-wrap gap-2 justify-between text-sm text-gray-700">
                    <span>Total:{h.total}</span>
                    <span>Processed:{h.processed}</span>
                    <span>Success:{h.success}</span>
                    <span>Failed:{h.failed}</span>
                  </div>

                  {/* Row 3: link to details */}
                  <div className="text-sm">
                    <Link
                      href={`/processed-file-data/${h._id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-custom_blue underline"
                    >
                      View details: {h._id}
                    </Link>
                  </div>
                </li>

                {/* Divider except after last */}
                {idx < history.length - 1 && (
                  <hr className="border-t border-gray-200 my-2" />
                )}
              </React.Fragment>
            );
          })}
        </ul>
      )}
    </div>
  );
}
