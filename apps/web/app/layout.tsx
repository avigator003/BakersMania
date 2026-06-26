import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AppProviders } from "../components/app-providers";

export const metadata: Metadata = {
  title: "BakersMania CRM",
  description: "PWA CRM for bakery operations, ordering, inventory, and billing.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "BakersMania",
    statusBarStyle: "default"
  }
};

export const viewport: Viewport = {
  themeColor: "#2f7d6f",
  width: "device-width",
  initialScale: 1
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
