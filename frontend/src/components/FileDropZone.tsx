import React from "react";

type FileDropZoneProps = {
  onFileSelect: (file: File) => void;
  disabled: boolean;
  selectedFile: File | null;
  dragActive: boolean;
  setDragActive: (active: boolean) => void;
};

export default function FileDropZone({
  onFileSelect,
  disabled,
  selectedFile,
  dragActive,
  setDragActive,
}: FileDropZoneProps) {
  const fileInput = React.useRef<HTMLInputElement>(null);

  const handleFiles = (files: FileList) => {
    if (files.length) onFileSelect(files[0]);
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (!disabled) setDragActive(true);
  };

  const onDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    if (!disabled) handleFiles(e.dataTransfer.files);
  };

  const triggerFileSelect = () => {
    if (!disabled && fileInput.current) fileInput.current.click();
  };

  return (
    <div
      className={`relative border-2 border-dashed rounded-lg p-6 text-center transition-colors
        ${dragActive ? "border-custom_blue bg-custom_less_blue" : "border-custom_gray bg-custom_white"}
        ${disabled ? "opacity-80 cursor-not-allowed" : "cursor-pointer"}`}
      onClick={triggerFileSelect}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      <input
        type="file"
        ref={fileInput}
        accept=".csv,.xlsx"
        disabled={disabled}
        className="hidden"
        onChange={(e) => e.target.files && handleFiles(e.target.files)}
      />
      {!selectedFile && (
        <>
          <p className="text-custom_gray">Drag & drop a file here, or click to select one</p>
          <p className="mt-2 text-sm text-custom_gray">(.csv, .xlsx)</p>
        </>
      )}
      {selectedFile && <p className="text-gray-700">Selected: {selectedFile.name}</p>}
    </div>
  );
}
