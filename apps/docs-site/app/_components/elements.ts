"use client";

// stylexn/elements imports React hooks and is not marked as a client module,
// so Next refuses to import it into a Server Component. Re-exported from a
// "use client" file, each element becomes a client reference that the
// server-rendered pages can use; sx values are plain objects and serialize.
export {
  FlatList,
  Image,
  Pressable,
  ScrollView,
  Switch,
  Text,
  TextInput,
  View,
} from "stylexn/elements";
