/** DOM stand-ins for React Native primitives (see testing/react-native.ts). */
import { createElement, type ReactNode } from "react";

type HostProps = {
  style?: unknown;
  children?: ReactNode;
  testID?: string;
  onPress?: () => void;
  onPressIn?: () => void;
  onPressOut?: () => void;
  onFocus?: () => void;
  onBlur?: () => void;
  onChangeText?: (text: string) => void;
  onSubmitEditing?: () => void;
  onScroll?: (event: { nativeEvent: { contentOffset: { x: number; y: number } } }) => void;
  onLoad?: () => void;
  onError?: () => void;
  [prop: string]: unknown;
};

/**
 * A host element: `data-style` holds the style, `data-props` the other
 * props (functions omitted). Press, focus, text, submit and scroll handlers
 * are wired to the DOM events Testing Library can fire.
 */
export function host(tag: string) {
  return function Host({
    style,
    children,
    testID,
    onPress,
    onPressIn,
    onPressOut,
    onFocus,
    onBlur,
    onChangeText,
    onSubmitEditing,
    onScroll,
    onLoad,
    onError,
    ...rest
  }: HostProps) {
    const serialisable = Object.fromEntries(
      Object.entries(rest).filter(([, v]) => typeof v !== "function"),
    );
    return createElement(
      tag,
      {
        "data-testid": testID,
        "data-style": JSON.stringify(style ?? null),
        "data-props": JSON.stringify(serialisable),
        onClick: onPress,
        onMouseDown: onPressIn,
        onMouseUp: onPressOut,
        onFocus,
        onBlur,
        onLoad,
        onError,
        onChange:
          onChangeText &&
          ((event: { target: { value: string } }) => onChangeText(event.target.value)),
        onKeyDown:
          onSubmitEditing &&
          ((event: { key: string }) => {
            if (event.key === "Enter") onSubmitEditing();
          }),
        onScroll:
          onScroll &&
          ((event: { currentTarget: { scrollLeft: number; scrollTop: number } }) =>
            onScroll({
              nativeEvent: {
                contentOffset: {
                  x: event.currentTarget.scrollLeft,
                  y: event.currentTarget.scrollTop,
                },
              },
            })),
      },
      children,
    );
  };
}
