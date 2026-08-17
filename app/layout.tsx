import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Metrolina Baseball Fall Development Survey",
  description: "Metrolina Christian Academy Baseball fall development goals survey.",
  icons: {
    icon: "/metrolina-logo.png",
    apple: "/metrolina-logo.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "MCA Survey",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#f7f7f8",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
