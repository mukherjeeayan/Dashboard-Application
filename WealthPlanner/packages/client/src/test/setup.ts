import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// Ensure each test unmounts React, since vitest globals are disabled and RTL's
// automatic cleanup therefore does not run.
afterEach(() => cleanup());
