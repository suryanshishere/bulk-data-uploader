import React from "react";

type LogsProps = {
  lines: string[];
};

export default function Logs({ lines }: LogsProps) {
  return (
    <div className="h-48 w-full overflow-y-auto bg-custom_black p-2 rounded border">
      {lines.map((line, i) => (
        <div key={i} className="text-xs font-mono text-white whitespace-pre-wrap">
          {line}
        </div>
      ))}
    </div>
  );
}