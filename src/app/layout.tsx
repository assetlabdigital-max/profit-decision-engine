import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Profit Decision Engine — BUY / SKIP / RISK for Amazon Sellers",
  description:
    "Paste an ASIN and get a clear Amazon sourcing verdict in seconds — margin, fees, competition, and risk flags. Free to start. Pro from $9.99/month.",
  openGraph: {
    title: "Profit Decision Engine",
    description: "One verdict. Not forty tabs of spreadsheet math.",
    url: "https://www.profit-decision-engine.com",
    siteName: "Profit Decision Engine",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
