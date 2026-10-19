import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "OneShopPlatform",
  description: "Create and deploy a shop with one click.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}