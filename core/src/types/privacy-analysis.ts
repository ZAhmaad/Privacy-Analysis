import { AnalysisError } from "./analysis-error";
import { CompactTrackingResult } from "./compact-logfile";
import { StorageSnapshot } from "./storage-snapshot";


type CookieSnapshot = Record<string, string>;

export { CookieSnapshot };

type CompactRequest = {
  url: string;
  status: number;
  type: string;
  initiator: any;
};

export { CompactRequest };

type PACompactLogfile = {
  site: string;
  trackingResultRecordChrome: Record<string, CompactTrackingResult | null>;
  trackingResultRecordBrave: Record<string, CompactTrackingResult | null>;
  storageSnapshotRecordChrome: Record<string, StorageSnapshot | null>;
  storageSnapshotRecordBrave: Record<string, StorageSnapshot | null>;
  cookieSnapshotRecordChrome: Record<string, CookieSnapshot | null>;
  cookieSnapshotRecordBrave: Record<string, CookieSnapshot | null>;
  requestCollectionChrome: CompactRequest[];
  requestCollectionBrave: CompactRequest[];
  errorCollectionChrome: AnalysisError[];
  errorCollectionBrave: AnalysisError[];
};

export { PACompactLogfile };
