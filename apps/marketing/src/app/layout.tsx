import type { Metadata } from "next";
import { Poppins } from "next/font/google";
import "./globals.css";
import { siteConfig } from "@timber/config/site";

const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: siteConfig.name,
    template: `%s | ${siteConfig.name}`,
  },
  description: siteConfig.description,
  metadataBase: new URL(siteConfig.url),
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="bg-warm-cream">
      <head>
        {/* Preload hero video for faster initial display */}
        <link
          rel="preload"
          href="/hero/hero.mp4"
          as="video"
          type="video/mp4"
        />
      </head>
      <body
        className={`${poppins.variable} antialiased min-h-screen bg-warm-cream`}
      >
        {children}
      </body>
    </html>
  );
}
