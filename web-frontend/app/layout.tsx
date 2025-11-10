import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Factory Management Portal",
  description: "Client-facing portal for factory operations.",
};

type RootLayoutProps = {
  children: React.ReactNode;
};

const RootLayout = ({ children }: RootLayoutProps) => (
  <html lang="en">
    <body>{children}</body>
  </html>
);

export default RootLayout;
