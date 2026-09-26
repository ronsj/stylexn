import type { ReactNode } from "react";
// globals.css first: it declares the reset layer before StyleX's priority
// layers, so the resets stay underneath every StyleX rule.
import "./globals.css";
import "stylexn/elements.css";

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
