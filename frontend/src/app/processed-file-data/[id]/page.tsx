"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Head from "next/head";

interface ErrorDetail {
  row: number;
  message: string;
}

interface StoreRecord {
  _id: string;
  status?: string;
  error?: string;
  record: {
    [key: string]: string | number;
  };
}

interface FileProcess {
  _id: string;
  userEmail: string;
  socketId?: string;
  filePath: string;
  total: number;
  processed: number;
  success: number;
  failed: number;
  processingErrors: ErrorDetail[];
  status: string;
  createdAt: string;
  updatedAt: string;
}

export default function FileProcessPage() {
  const params = useParams();
  const id = params.id as string;
  const LIMIT = 10;
  const base = process.env.NEXT_PUBLIC_BACKEND_URL;

  const [data, setData] = useState<FileProcess | null>(null);
  const [records, setRecords] = useState<StoreRecord[]>([]);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchInitialData = async () => {
    if (!id) return;
    try {
      setLoading(true);
      setError(null);

      const url = new URL(`${base}/processed-file-data/${id}`);
      url.searchParams.set("skip", "0");
      url.searchParams.set("limit", String(LIMIT));

      const res = await fetch(url.toString());
      if (!res.ok) {
        let msg = `Error fetching initial data: ${res.status}`;
        try {
          const errJson = await res.json();
          if (errJson?.error) msg += ` (${errJson.error})`;
        } catch {}
        throw new Error(msg);
      }
      const json = await res.json();

      if (!json.fileProcess) {
        throw new Error("No fileProcess in response");
      }
      setData(json.fileProcess as FileProcess);

      if (Array.isArray(json.records)) {
        setRecords(json.records as StoreRecord[]);
        setHasMore(json.records.length >= LIMIT);
        setPage(1);
      } else if (json.record) {
        setRecords([json.record as StoreRecord]);
        setHasMore(false);
        setPage(1);
      } else {
        setRecords([]);
        setHasMore(false);
        setPage(1);
      }
    } catch (err: any) {
      console.error("fetchInitialData error:", err);
      setError(err.message || "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  const fetchNextRecords = async () => {
    if (!hasMore || loadingMore || !id) return;

    try {
      setLoadingMore(true);
      setError(null);

      const url = new URL(`${base}/processed-file-data/${id}`);
      url.searchParams.set("skip", String(page * LIMIT));
      url.searchParams.set("limit", String(LIMIT));

      const res = await fetch(url.toString());
      if (!res.ok) {
        let msg = `Error fetching more records: ${res.status}`;
        try {
          const errJson = await res.json();
          if (errJson?.error) msg += ` (${errJson.error})`;
        } catch {}
        throw new Error(msg);
      }

      const json = await res.json();
      if (Array.isArray(json.records)) {
        const newRecs = json.records as StoreRecord[];
        setRecords((prev) => [...prev, ...newRecs]);
        setHasMore(newRecs.length >= LIMIT);
        setPage((prev) => prev + 1);
      } else {
        setHasMore(false);
      }
    } catch (err: any) {
      console.error("fetchNextRecords error:", err);
      setError(err.message || "Failed to load more records");
    } finally {
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    if (!id) return;
    setData(null);
    setRecords([]);
    setPage(0);
    setHasMore(true);
    setError(null);
    fetchInitialData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    const handleScroll = () => {
      const nearBottom =
        window.innerHeight + window.scrollY >= document.body.offsetHeight - 300;
      if (nearBottom && hasMore && !loadingMore) {
        fetchNextRecords();
      }
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, [hasMore, loadingMore]);

  const headers: string[] =
    records.length > 0 ? Object.keys(records[0].record || {}) : [];

  return (
    <div className="w-full px-4">
      <Head>
        <title>Processed File Data</title>
        <meta
          name="description"
          content="Your file data that is processed so far or completed to share with people"
        />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <h1 className="text-xl font-semibold mb-4">File Process Details</h1>

      {loading && page === 0 ? (
        <p className="p-4">Loading...</p>
      ) : error ? (
        <p className="p-4 text-red-600">Error: {error}</p>
      ) : !data ? (
        <p className="p-4">No data found.</p>
      ) : (
        <>
          <p>
            <strong>ID:</strong> {data._id}
          </p>
          <p>
            <strong>Email:</strong> {data.userEmail}
          </p>
          <p>
            <strong>Status:</strong> {data.status}
          </p>
          <p>
            <strong>Total:</strong> {data.total}
          </p>
          <p>
            <strong>Processed:</strong> {data.processed}
          </p>
          <p>
            <strong>Success:</strong> {data.success}
          </p>
          <p>
            <strong>Failed:</strong> {data.failed}
          </p>

          <h2 className="mt-6 text-lg font-medium">Errors</h2>
          {data.processingErrors && data.processingErrors.length > 0 ? (
            <ul className="list-disc list-inside text-sm">
              {data.processingErrors.map((err) => (
                <li key={err.row}>
                  Row {err.row}: {err.message}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm">No processing errors.</p>
          )}

          <h2 className="mt-6 text-lg font-medium">Records</h2>
          {records.length > 0 ? (
            <table className="w-full border-collapse mt-4 text-sm">
              <thead>
                <tr>
                  {headers
                    .filter(
                      (key) =>
                        key !== "status" &&
                        key !== "error" &&
                        key !== "_id" &&
                        key !== "id"
                    )
                    .map((key) => (
                      <th key={key} className="border p-2">
                        {key}
                      </th>
                    ))}
                </tr>
              </thead>
              <tbody>
                {records.map((rec) => (
                  <tr key={rec._id}>
                    {headers
                      .filter(
                        (key) =>
                          key !== "status" &&
                          key !== "error" &&
                          key !== "_id" &&
                          key !== "id"
                      )
                      .map((key) => (
                        <td key={key} className="border p-2">
                          {rec.record[key] ?? "-"}
                        </td>
                      ))}
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p>No records found.</p>
          )}

          {loadingMore && (
            <p className="text-center mt-4 text-sm text-gray-600">
              Loading more records...
            </p>
          )}
          {!hasMore && records.length > 0 && (
            <p className="text-center mt-4 text-sm text-gray-500">
              No more records.
            </p>
          )}
        </>
      )}
    </div>
  );
}
