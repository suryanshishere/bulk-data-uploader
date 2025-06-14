import './globals.css';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Bulk Data Uploader'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-gray-50">{children}</body>
    </html>
  );
}