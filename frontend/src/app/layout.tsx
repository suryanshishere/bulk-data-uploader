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
      <body className="relative my-10 min-h-screen w-full flex flex-col justify-center items-center gap-20 bg-gray-100 p-4">
        {children}
      </body>
    </html>
  );
}
