import * as fsPromises from "fs/promises";
import path from "path";
import {
  AnalysisError,
  CompactTrackingResult,
  StorageSnapshot,
  PACompactLogfile,
  CookieSnapshot,
  CompactRequest,
  PACompactBrowserLogfile,
} from "@yuantijs/core";

class BrowserAnalysisLogger {
  #trackingResultRecord: Record<string, CompactTrackingResult | null>;
  #storageSnapshotRecord: Record<string, StorageSnapshot | null>;
  #cookieSnapshotRecord: Record<string, CookieSnapshot | null>;
  #requestCollection: CompactRequest[];
  #errorCollection: AnalysisError[];

  constructor() {
    this.#trackingResultRecord = {};
    this.#storageSnapshotRecord = {};
    this.#cookieSnapshotRecord = {};
    this.#requestCollection = [];
    this.#errorCollection = [];
  }

  setTrackingResultRecord(
    trackingResultRecord: Record<string, CompactTrackingResult | null>
  ): void {
    this.#trackingResultRecord = trackingResultRecord;
  }

  setStorageSnapshotRecord(
    storageSnapshotRecord: Record<string, StorageSnapshot | null>
  ): void {
    this.#storageSnapshotRecord = storageSnapshotRecord;
  }

  setCookieSnapshotRecord(
    cookieSnapshotRecord: Record<string, CookieSnapshot | null>
  ): void {
    this.#cookieSnapshotRecord = cookieSnapshotRecord;
  }

  setRequestCollection(requestCollection: CompactRequest[]): void {
    this.#requestCollection = requestCollection;
  }

  addError(error: AnalysisError): void {
    this.#errorCollection = [...this.#errorCollection, error];
  }

  getCompactBrowserLogfile(): PACompactBrowserLogfile {
    return {
      trackingResultRecord: this.#trackingResultRecord,
      storageSnapshotRecord: this.#storageSnapshotRecord,
      cookieSnapshotRecord: this.#cookieSnapshotRecord,
      requestCollection: this.#requestCollection,
      errorCollection: this.#errorCollection,
    };
  }
}

class AnalysisLogger {
  #analysisName: string;
  #site: string;
  chromeAnalysisLogger: BrowserAnalysisLogger;
  braveAnalysisLogger: BrowserAnalysisLogger;

  constructor(analysisName: string, site: string) {
    this.#analysisName = analysisName;
    this.#site = site;
    this.chromeAnalysisLogger = new BrowserAnalysisLogger();
    this.braveAnalysisLogger = new BrowserAnalysisLogger();
  }

  async persist(): Promise<void> {
    const compactLogfile: PACompactLogfile = {
      site: this.#site,
      chrome: this.chromeAnalysisLogger.getCompactBrowserLogfile(),
      brave: this.braveAnalysisLogger.getCompactBrowserLogfile(),
    };
    await fsPromises.writeFile(
      await this.#touchFile("logs.json"),
      JSON.stringify(compactLogfile)
    );
  }

  async #touchFile(filename: string): Promise<string> {
    const resultsDir = path.join("results", this.#analysisName, this.#site);
    await fsPromises.mkdir(resultsDir, { recursive: true });
    return path.join(resultsDir, filename);
  }
}

export default AnalysisLogger;
