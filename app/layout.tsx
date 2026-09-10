import type { Metadata } from "next";
import { Anta } from "next/font/google";
import "./globals.css";
import SessionProvider from "@/components/providers/SessionProvider";

const anta = Anta({
  weight: "400",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "RAW Society",
  description: "RAW Society",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={anta.className}>
        <SessionProvider>
          {children}
        </SessionProvider>
      </body>
    </html>
  );
}