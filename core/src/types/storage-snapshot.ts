import { validateRecordOfString } from "./helpers";

interface StorageSnapshot {
  localStorage: Record<string, string>;
  sessionStorage: Record<string, string>;
}

function validateStorageSnapshot(value: unknown): value is StorageSnapshot {
  return (
    typeof value === "object" &&
    value !== null &&
    "localStorage" in value &&
    validateRecordOfString(value.localStorage) &&
    "sessionStorage" in value &&
    validateRecordOfString(value.sessionStorage)
  );
}

export { StorageSnapshot, validateStorageSnapshot as validateStorageSnapshot };
