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
      <body className="relative min-h-screen w-full flex flex-col justify-center items-center gap-20 bg-gray-100 p-4">
        
        {children}
        <div className="flex flex-col gap-4">
          <a
            href="https://dummy-data-gen-1061052074258.europe-north2.run.app/generate-stores?count=50000"
            className="text-custom_blue underline w-[25rem] text-center"
          >
            Download test dataset file for testing purpose
          </a>

          <p className="text-xs w-full medium_mobile:w-[25rem] text-gray-500 font-mono text-center">
            Render backend is slow. So, please be patience while processing a
            backend request.
          </p>
        </div>
      </body>
    </html>
  );
}
