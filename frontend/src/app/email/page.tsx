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
    </>
  );
}
