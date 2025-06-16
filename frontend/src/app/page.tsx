"use client";
import FileUploader from "../components/FileUploader";

export default function Page() {
  return (
    <main className="p-6 min-w-88 max-w-88 rounded shadow">
      <h1 className="text-2xl font-semibold mb-6 text-center font-mono">
        Bulk Data Uploader
      </h1>
      <FileUploader />
    </main>
  );
}
