"use client";
import FileUploader from "../components/FileUploader";

export default function Page() {
  return (
    <main className="mt-20 w-[25rem] flex flex-col gap-6">
      <div className="flex flex-col">
        <h1 className="text-2xl font-semibold mb-6 text-center font-mono">
          Bulk Data Uploader
        </h1>
        <p className="text-center">
          To process your file, enter your email and upload it. Your email will
          also be used to fetch your history and processing files.
        </p>
      </div>
      <FileUploader />
    </main>
  );
}
