// Local preview status only. Approval must eventually come from the server.
const eventName = "bank:kyc-status";
const pendingProfiles = new Set<string>();
const storageKey = (profileId: string) => `bank:kyc:${profileId}`;

export function isKycPending(profileId: string): boolean {
  if (pendingProfiles.has(profileId)) return true;
  try { return window.sessionStorage.getItem(storageKey(profileId)) === "pending"; }
  catch { return false; }
}

export function markKycPending(profileId: string): void {
  pendingProfiles.add(profileId);
  try { window.sessionStorage.setItem(storageKey(profileId), "pending"); }
  catch { /* Keep the status in memory when browser storage is unavailable. */ }
  window.dispatchEvent(new Event(eventName));
}

export function subscribeKycStatus(onChange: () => void): () => void {
  window.addEventListener(eventName, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(eventName, onChange);
    window.removeEventListener("storage", onChange);
  };
}

export const serverKycPending = () => false;
