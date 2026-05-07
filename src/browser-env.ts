export type BrowserWindow = typeof globalThis & Window;

export function browserWindow(): BrowserWindow {
  const scope = globalThis as typeof globalThis & {
    window?: Window;
  };
  return (scope.window ?? scope) as BrowserWindow;
}

export function browserDocument(): Document {
  return browserWindow().document;
}
