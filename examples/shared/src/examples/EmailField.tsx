"use client";

import { useRef, useState } from "react";
import * as stylex from "stylexn";
import { Pressable, Text, TextInput, View } from "stylexn/elements";
import type { TextInputHandle } from "stylexn/elements";

const DARK = "@media (prefers-color-scheme: dark)";

const styles = stylex.create({
  stack: {
    width: 300,
    maxWidth: "100%",
    gap: 8,
  },
  row: {
    flexDirection: "row",
    gap: 8,
  },
  input: {
    flexGrow: 1,
    flexShrink: 1,
    minWidth: 0,
    paddingBlock: 8,
    paddingInline: 12,
    borderRadius: 8,
    borderWidth: 2,
    borderStyle: "solid",
    borderColor: { default: "#d6d0e2", ":focus": "#6a3db8" },
    backgroundColor: { default: "#ffffff", [DARK]: "#1f1c26" },
    // TextInput does not inherit text styles: set them on the input.
    color: { default: "#1f1b26", [DARK]: "#f3f0f8", "::placeholder": "#8c8599" },
    fontSize: 15,
    caretColor: "#6a3db8",
  },
  clear: {
    justifyContent: "center",
    paddingInline: 12,
    borderRadius: 8,
    backgroundColor: { default: "#ede7f8", ":hover": "#dccff3", [DARK]: "#2e2640" },
    color: { default: "#3d2a66", [DARK]: "#e6dcff" },
    fontSize: 14,
    fontWeight: 600,
  },
  status: {
    fontSize: 14,
    color: { default: "#5b5566", [DARK]: "#b9b2c6" },
  },
});

export function EmailField() {
  const input = useRef<TextInputHandle>(null);
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState<string | null>(null);
  return (
    <View sx={styles.stack}>
      <View sx={styles.row}>
        <TextInput
          ref={input}
          sx={styles.input}
          value={email}
          onChangeText={setEmail}
          onSubmitEditing={() => setSent(email)}
          placeholder="you@example.com"
          aria-label="Email"
          keyboardType="email-address"
          returnKeyType="send"
          autoCapitalize="none"
          autoCorrect={false}
        />
        <Pressable
          sx={styles.clear}
          onPress={() => {
            input.current?.clear();
            input.current?.focus();
          }}
        >
          <Text>Clear</Text>
        </Pressable>
      </View>
      <Text sx={styles.status}>{sent ? `Sent to ${sent}` : "Type an address and press Enter"}</Text>
    </View>
  );
}
