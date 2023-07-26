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
  postData?: string;
};

export { CompactRequest };

type PACompactBrowserLogfile = {
  trackingResultRecord: Record<string, CompactTrackingResult | null>;
  storageSnapshotRecord: Record<string, StorageSnapshot | null>;
  cookieSnapshotRecord: Record<string, CookieSnapshot | null>;
  requestCollection: CompactRequest[];
  errorCollection: AnalysisError[];
};

type PACompactLogfile = {
  site: string;
  chrome: PACompactBrowserLogfile;
  brave: PACompactBrowserLogfile;
};

export { PACompactBrowserLogfile, PACompactLogfile };
