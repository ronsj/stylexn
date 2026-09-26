import type { ReactNode } from "react";
import "./globals.css";

export const metadata = {
  title: "StyleXN",
  description: "StyleX for React Native and the web.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
