import assert from "assert";
import { AnalysisError } from "./analysis-error";
import {
  StorageLabel,
  expandAnalysisLabel,
  isStorageLabel,
} from "./analysis-label";
import { CompactLogfile, CompactTrackingResult } from "./compact-logfile";
import { Label } from "./label";
import { StorageSnapshot } from "./storage-snapshot";

interface Flow {
  taint: Label[];
  sinkLabel: Label;
}

export { Flow };

function flowLabels(flow: Flow): Label[] {
  return [...flow.taint, flow.sinkLabel];
}

export { flowLabels };

interface TrackingResult {
  flowCollection: Flow[];
  storageLabelCollection: StorageLabel[];
}

function expandTrackingResult(
  compact: CompactTrackingResult,
  baseUrl: string
): TrackingResult {
  const labelMap = new Map(
    Object.values(compact.labelMap).map((compactLabel) => [
      compactLabel.id,
      expandAnalysisLabel(compactLabel, baseUrl),
    ])
  );
  const tryGetLabelById = (labelId: number): Label => {
    const label = labelMap.get(labelId);
    assert(label !== undefined);
    return label;
  };
  const flowCollection: Flow[] = compact.flowCollection.map((compactFlow) => ({
    taint: compactFlow.taint.map((labelId) => tryGetLabelById(labelId)),
    sinkLabel: tryGetLabelById(compactFlow.sinkLabel),
  }));
  const storageLabelCollection: Label[] = compact.storageLabelCollection.map(
    (labelId) => tryGetLabelById(labelId)
  );
  assert(
    storageLabelCollection.every((label): label is StorageLabel =>
      isStorageLabel(label)
    )
  );
  return {
    flowCollection,
    storageLabelCollection,
  };
}

export { TrackingResult, expandTrackingResult };

type Logfile = {
  site: string;
  trackingResultRecord: Record<string, TrackingResult>;
  storageSnapshotRecordA: Record<string, StorageSnapshot>;
  storageSnapshotRecordB1: Record<string, StorageSnapshot>;
  storageSnapshotRecordB2: Record<string, StorageSnapshot>;
  errorCollection: AnalysisError[];
};

function _compactRecordWithOnlyGoodEntries<Value>(
  record: Record<string, Value | null>
): Record<string, Value> {
  return Object.fromEntries(
    Object.entries(record).filter(([url, value]) => {
      try {
        return new URL(url).origin !== "null" && value !== null;
      } catch (_) {
        return false;
      }
    }) as Array<[string, Value]>
  );
}

function expandLogfile(compact: CompactLogfile): Logfile {
  return {
    site: compact.site,
    trackingResultRecord: Object.fromEntries(
      Object.entries(
        _compactRecordWithOnlyGoodEntries(compact.trackingResultRecord)
      ).map(([url, compactTrackingResult]) => [
        url,
        compactTrackingResult &&
          expandTrackingResult(compactTrackingResult, url),
      ])
    ),
    storageSnapshotRecordA: _compactRecordWithOnlyGoodEntries(
      compact.storageSnapshotRecordA
    ),
    storageSnapshotRecordB1: _compactRecordWithOnlyGoodEntries(
      compact.storageSnapshotRecordB1
    ),
    storageSnapshotRecordB2: _compactRecordWithOnlyGoodEntries(
      compact.storageSnapshotRecordB2
    ),
    errorCollection: compact.errorCollection,
  };
}

export { Logfile, expandLogfile };
