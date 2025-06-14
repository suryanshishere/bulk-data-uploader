'use client';
import FileUploader from './components/FileUploader';

export default function Page() {
  return (
    <main className="min-h-screen flex items-center justify-center">
      <div className="w-full max-w-md p-6 bg-white rounded shadow">
        <h1 className="text-2xl font-semibold mb-6 text-center">
          Bulk Data Uploader
        </h1>
        <FileUploader />
      </div>
    </main>
  );
}