import * as stylex from "@stylexjs/stylex";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { View } from "./_components/elements";
// globals.css first: it declares the reset layer before StyleX's priority
// layers, so the resets stay underneath every StyleX rule.
import "./globals.css";
import "stylexn/elements.css";
import { Nav } from "./_components/Nav";
import { Pager } from "./_components/Pager";
import { colors, fonts, space } from "./_components/tokens.stylex";

export const metadata: Metadata = {
  title: { default: "StyleXN", template: "%s · StyleXN" },
  description: "Author styles with the StyleX API and render them on React Native and the web.",
};

const WIDE = "@media (min-width: 900px)";

const styles = stylex.create({
  html: {
    // Lets light-dark() and the browser's own controls follow the OS setting.
    colorScheme: "light dark",
    backgroundColor: colors.page,
  },
  body: {
    minHeight: "100vh",
    fontFamily: fonts.body,
    color: colors.text,
    backgroundColor: colors.page,
    WebkitFontSmoothing: "antialiased",
  },
  shell: {
    flexDirection: { default: "column", [WIDE]: "row" },
    minHeight: "100vh",
  },
  main: {
    gap: space.lg,
    flexGrow: 1,
    flexShrink: 1,
    minWidth: 0,
    maxWidth: 1180,
    paddingBlock: { default: space.xl, [WIDE]: space.xxl },
    paddingInline: { default: space.lg, [WIDE]: space.xxl },
  },
});

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" {...stylex.props(styles.html)}>
      <body {...stylex.props(styles.body)}>
        <View sx={styles.shell}>
          <Nav />
          <View role="main" sx={styles.main}>
            {children}
            <Pager />
          </View>
        </View>
      </body>
    </html>
  );
}
