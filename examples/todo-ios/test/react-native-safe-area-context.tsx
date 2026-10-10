import type { ReactNode } from "react";

// A device with a notch and a home indicator, so tests see env() insets.
export const TEST_INSETS = { top: 47, right: 0, bottom: 34, left: 0 };

export function SafeAreaProvider({ children }: { children?: ReactNode }) {
  return children;
}

export function useSafeAreaInsets() {
  return TEST_INSETS;
}
