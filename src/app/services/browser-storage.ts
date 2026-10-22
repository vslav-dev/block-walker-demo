// The browser's storage, for what is kept between visits. Without it (a private window, blocked storage) nothing is kept
// and nothing breaks: the values then last until the page is closed.

export function readStorage(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writeStorage(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // the value then lasts until the page is closed
  }
}
