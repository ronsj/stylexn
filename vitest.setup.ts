// Testing Library only auto-cleans with globals enabled; do it explicitly.
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

afterEach(cleanup);
