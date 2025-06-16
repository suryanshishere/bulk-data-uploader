import "../globals.css";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Bulk Data Uploader",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="relative min-h-screen w-full flex flex-col justify-center items-center gap-10 bg-gray-100 p-4">
        {children}
        <p className="text-xs text-gray-500 font-mono text-center">
          Render backend is slow. So, please be patience while processing a
          backend request.
        </p>
      </body>
    </html>
  );
}
