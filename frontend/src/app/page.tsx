"use client";
import FileUploader from "../components/FileUploader";

export default function Page() {
  return (
    <main className="mt-20 w-[25rem] flex flex-col">
      <h1 className="text-2xl font-semibold mb-6 text-center font-mono">
        Bulk Data Uploader
      </h1>
      <p>
        Share your data anywhere you want. Provide your email and file, and we
        will email you the processed file data link upon completion. If you stay
        on this page after uploading, the link will also be displayed here once
        processing is finished.
      </p>
      <FileUploader />
    </main>
  );
}
