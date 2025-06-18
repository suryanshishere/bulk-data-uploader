// app/page.tsx
"use client";

import React, { useState, ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import { Input } from "../components/Input"; // adjust path if needed
// If you don't have a styled Input component, you can replace with a normal <input>.

const isValidEmail = (email: string) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

export default function HomePage() {
  const [email, setEmail] = useState("");
  const router = useRouter();

  const handleSubmit = () => {
    const trimmed = email.trim();
    if (!isValidEmail(trimmed)) {
      // You can show some UI feedback here; for simplicity use alert
      alert("Please enter a valid email.");
      return;
    }
    // Navigate to /email with query param. The browser URL will be:
    // /email?email=example%40domain.com
    router.push(`/email?email=${encodeURIComponent(trimmed)}`);
  };

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
        <Input
          name="email"
          label="Enter your email to continue"
          type="email"
          required
          placeholder="you@example.com"
          value={email}
          onChange={(e: ChangeEvent<HTMLInputElement>) =>
            setEmail(e.target.value)
          }
          error={email.length > 0 && !isValidEmail(email)}
        />
        <button
          onClick={handleSubmit}
          disabled={!isValidEmail(email)}
          className={`mt-4 w-full h-10 font-semibold rounded custom_go ${
            !isValidEmail(email) ? "bg-gray-400 cursor-not-allowed" : ""
          }`}
        >
          Continue
        </button>
      </div>
      <div className="text-xs w-full medium_mobile:w-[25rem] text-gray-500 font-mono text-center">
        <a href="https://dummy-data-gen-1061052074258.europe-north2.run.app/generate-stores?count=50000" className="text-custom_blue">
          Click here to Download test dataset file
        </a>

        <p>
          Render backend and redis cloud is slow. So, please be patience while processing a
          backend request.
        </p>
      </div>
    </>
  );
}
