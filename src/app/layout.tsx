import type { Viewport } from "next";
import { Outfit } from "next/font/google";
import "./globals.css";
import type { Metadata } from "next";
import { PwaInstallPrompt } from "@/components/pwa/PwaInstallPrompt";

const outfit = Outfit({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-outfit",
});

export const viewport: Viewport = {
  themeColor: "#1dbf73",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export const metadata: Metadata = {
  title: "Attendance System",
  description: "Secure and modern attendance management platform.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Attendance System",
  },
  formatDetection: {
    telephone: false,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${outfit.variable} h-full antialiased`}
      suppressHydrationWarning={true}
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              window.addEventListener('beforeinstallprompt', function(e) {
                e.preventDefault();
                window.pwaInstallPrompt = e;
                // Dispatch a custom event so React can catch it immediately if it mounts later
                window.dispatchEvent(new Event('pwa-ready'));
              });
            `,
          }}
        />
      </head>
      <body className={`min-h-full flex flex-col ${outfit.className}`} suppressHydrationWarning={true}>
        {children}
        <PwaInstallPrompt />
      </body>
    </html>
  );
}

