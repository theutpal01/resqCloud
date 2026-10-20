import type { Metadata } from "next";
import localFont from "next/font/local";
import { AuthProvider } from "../components/providers/AuthProvider";
import "./globals.css";

const bodyFont = localFont({
  src: "./fonts/NotoSans-Regular.woff2",
  variable: "--font-body",
  display: "swap",
});
const displayFont = localFont({
  src: "./fonts/NotoSerif-Regular.woff2",
  variable: "--font-display",
  display: "swap",
});
export const metadata: Metadata = {
  title: "ResQCloud | Incident response",
  description:
    "Coordinate incident reports, dispatch teams and track response.",
  icons: { icon: "/favicon.svg" },
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${bodyFont.variable} ${displayFont.variable}`}>
      <body>
        <a className="skip-link" href="#main">
          Skip to main content
        </a>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
