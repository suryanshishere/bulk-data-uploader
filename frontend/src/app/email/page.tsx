// app/email/page.tsx
import React from "react";
import FileUploader from "../../components/FileUploader"; // adjust path as needed

interface EmailPageProps {
  searchParams: {
    email?: string;
  };
}

export default function EmailPage({ searchParams }: EmailPageProps) {
  const { email } = searchParams;

  // If no email in URL, show a message or redirect back to homepage.
  if (!email) {
    return (
      <div className="w-full medium_mobile:w-[25rem]">
        <p className="text-red-600">
          No email provided. Please go back and enter your email.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="w-full medium_mobile:w-[25rem] flex flex-col gap-4 mt-10">
        <h1 className="text-2xl font-semibold text-center font-mono">
          Bulk Data Uploader
        </h1>
        <p className="text-center">
          To process your file, enter your email and upload it. Your email will
          also be used to fetch your history and processing files.
        </p>
      </div>
      <div className="w-full medium_mobile:w-[25rem]">
        <FileUploader initialEmail={email} />
      </div>
      <div className="text-xs w-full medium_mobile:w-[25rem] text-gray-500 font-mono text-center">
        <a className="text-custom_blue" href="https://dummy-data-gen-1061052074258.europe-north2.run.app/generate-stores?count=50000">
          Download test dataset file for testing purpose
        </a>

        <p>
          Render backend is slow. So, please be patience while processing a
          backend request.
        </p>
      </div>
    </>
  );
}
