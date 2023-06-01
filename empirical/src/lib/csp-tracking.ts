import { Logfile, StorageSnapshot } from "@yuantijs/core";
import { areSignificantlyDifferent } from "./significant-difference";

function getCspTrackingKeyCollection(
  storageSnapshotA: StorageSnapshot,
  storageSnapshotB1: StorageSnapshot,
  storageSnapshotB2: StorageSnapshot
): string[] {
  const maxSupportedValueLength = 10000;
  const localStorageA = storageSnapshotA.localStorage;
  const localStorageB1 = storageSnapshotB1.localStorage;
  const localStorageB2 = storageSnapshotB2.localStorage;
  return Object.entries(localStorageA)
    .filter(
      ([key, value]) =>
        key in localStorageB1 &&
        key in localStorageB2 &&
        value.length >= 8 &&
        localStorageB1[key] === localStorageB2[key] &&
        value.length < maxSupportedValueLength &&
        localStorageB1[key].length < maxSupportedValueLength &&
        areSignificantlyDifferent(value, localStorageB1[key])
    )
    .map(([key, _]) => key);
}

function getCspTrackingKeyCollectionRecord(
  logfile: Logfile
): Record<string, string[] | undefined> {
  return Object.fromEntries(
    Object.entries(logfile.storageSnapshotRecordA).map(
      ([origin, storageSnapshotA]) => {
        const storageSnapshotB1 = logfile.storageSnapshotRecordB1[origin];
        const storageSnapshotB2 = logfile.storageSnapshotRecordB2[origin];
        return [
          origin,
          storageSnapshotB1 && storageSnapshotB2
            ? getCspTrackingKeyCollection(
                storageSnapshotA,
                storageSnapshotB1,
                storageSnapshotB2
              )
            : [],
        ];
      }
    )
  );
}

export { getCspTrackingKeyCollectionRecord };
