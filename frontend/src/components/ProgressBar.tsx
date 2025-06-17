import React from "react";

type ProgressBarProps = {
  label: string;
  progress: number;
};

export default function ProgressBar({ label, progress }: ProgressBarProps) {
  return (
    <div className="w-full">
      <p className="text-sm text-custom_gray">{label}</p>
      <div className="w-full h-4 bg-gray-200 rounded">
        <div
          className="h-4 bg-custom_blue rounded transition-all duration-200"
          style={{ width: `${progress}%` }}
        />
      </div>
      <p className="text-right text-sm text-custom_gray">{progress}%</p>
    </div>
  );
}