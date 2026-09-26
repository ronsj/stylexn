/** DOM stand-ins for React Native primitives (see testing/react-native.ts). */
import { createElement, type ReactNode, type Ref } from "react";

type HostProps = {
  style?: unknown;
  children?: ReactNode;
  testID?: string;
  ref?: Ref<unknown>;
  onValueChange?: (value: boolean) => void;
  onPress?: () => void;
  onPressIn?: () => void;
  onPressOut?: () => void;
  onLongPress?: () => void;
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
    onLongPress,
    onFocus,
    onBlur,
    onChangeText,
    onSubmitEditing,
    onScroll,
    onLoad,
    onError,
    onValueChange,
    ref,
    ...rest
  }: HostProps) {
    const serialisable = Object.fromEntries(
      Object.entries(rest).filter(([, v]) => typeof v !== "function"),
    );
    return createElement(
      tag,
      {
        ref,
        "data-testid": testID,
        "data-style": JSON.stringify(style ?? null),
        "data-props": JSON.stringify(serialisable),
        onClick: onPress,
        onMouseDown: onPressIn,
        onMouseUp: onPressOut,
        // A long press opens the context menu on touch devices: fire contextMenu to simulate one.
        onContextMenu: onLongPress,
        onFocus,
        onBlur,
        onLoad,
        onError,
        onChange: onChangeText
          ? (event: { target: { value: string } }) => onChangeText(event.target.value)
          : onValueChange &&
            ((event: { target: { checked: boolean } }) => onValueChange(event.target.checked)),
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
