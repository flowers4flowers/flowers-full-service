// next/utility/clarity.ts

declare global {
  interface Window {
    clarity?: (...args: unknown[]) => void;
  }
}

const isClarityAvailable = () =>
  typeof window !== "undefined" && typeof window.clarity === "function";

export const claritySet = (key: string, value: string) => {
  if (!isClarityAvailable()) return;

  try {
    window.clarity!("set", key, value);
  } catch (error) {
    console.error("Clarity tag error:", error);
  }
};

export const clarityEvent = (name: string) => {
  if (!isClarityAvailable()) return;

  try {
    window.clarity!("event", name);
  } catch (error) {
    console.error("Clarity event error:", error);
  }
};

export const clarityIdentify = (customId: string, friendlyName?: string) => {
  if (!isClarityAvailable()) return;

  try {
    window.clarity!("identify", customId, undefined, undefined, friendlyName);
  } catch (error) {
    console.error("Clarity identify error:", error);
  }
};
