import React from "react";

type UploadButtonProps = {
  onClick: () => void;
  disabled: boolean;
  progress: number;
  statusText: string;
};

export default function UploadButton({ onClick, disabled, progress, statusText }: UploadButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`relative w-full h-10 font-semibold custom_go flex items-center
        ${disabled ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'}
        text-white disabled:opacity-80 disabled:cursor-not-allowed`}
    >
      {progress >= 0 && (
        <div
          role="progressbar"
          aria-valuenow={progress}
          aria-valuemin={0}
          aria-valuemax={100}
          className="absolute left-0 top-0 h-full bg-custom_green transition-all duration-200"
          style={{ width: `${progress}%` }}
        />
      )}
      <span className="relative z-10 w-full text-center">{statusText}</span>
    </button>
  );
}
