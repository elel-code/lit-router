export type BrowserWindow = typeof globalThis & Window;

function isBrowserWindow(value: unknown): value is BrowserWindow {
  return (
    typeof value === "object" &&
    value !== null &&
    "document" in value &&
    "history" in value &&
    "location" in value
  );
}

export function browserWindow(): BrowserWindow {
  const scope = globalThis as typeof globalThis & {
    window?: Window;
  };
  if (isBrowserWindow(scope.window)) {
    return scope.window;
  }

  if (isBrowserWindow(scope)) {
    return scope;
  }

  throw new Error(
    "lit-router requires a browser Window-like global with document, history, and location.",
  );
}

export function browserDocument(): Document {
  return browserWindow().document;
}
