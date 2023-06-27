import * as fsPromises from "fs/promises";
import path from "path";
import {
  AnalysisError,
  CompactTrackingResult,
  StorageSnapshot,
  PACompactLogfile,
  CookieSnapshot,
  CompactRequest,
} from "@yuantijs/core";

class AnalysisLogger {
  #analysisName: string;
  #site: string;
  #trackingResultRecordChrome: Record<string, CompactTrackingResult | null>;
  #trackingResultRecordBrave: Record<string, CompactTrackingResult | null>;
  #storageSnapshotRecordChrome: Record<string, StorageSnapshot | null>;
  #storageSnapshotRecordBrave: Record<string, StorageSnapshot | null>;
  #cookieSnapshotRecordChrome: Record<string, CookieSnapshot | null>;
  #cookieSnapshotRecordBrave: Record<string, CookieSnapshot | null>;
  #requestCollectionChrome: CompactRequest[];
  #requestCollectionBrave: CompactRequest[];
  #errorCollectionChrome: AnalysisError[];
  #errorCollectionBrave: AnalysisError[];
  

  constructor(analysisName: string, site: string) {
    this.#analysisName = analysisName;
    this.#site = site;
    this.#trackingResultRecordChrome = {};
    this.#trackingResultRecordBrave = {};
    this.#storageSnapshotRecordChrome = {};
    this.#storageSnapshotRecordBrave = {};
    this.#cookieSnapshotRecordChrome = {};
    this.#cookieSnapshotRecordBrave = {};
    this.#requestCollectionChrome = [];
    this.#requestCollectionBrave = [];
    this.#errorCollectionChrome = [];
    this.#errorCollectionBrave = [];
  }

  setTrackingResultRecordChrome(
    trackingResultRecord: Record<string, CompactTrackingResult | null>
  ): void {
    this.#trackingResultRecordChrome = trackingResultRecord;
  }

  setTrackingResultRecordBrave(
    trackingResultRecord: Record<string, CompactTrackingResult | null>
  ): void {
    this.#trackingResultRecordBrave = trackingResultRecord;
  }

  setStorageSnapshotRecordChrome(
    storageSnapshotRecord: Record<string, StorageSnapshot | null>
  ): void {
    this.#storageSnapshotRecordChrome = storageSnapshotRecord;
  }

  setStorageSnapshotRecordBrave(
    storageSnapshotRecord: Record<string, StorageSnapshot | null>
  ): void {
    this.#storageSnapshotRecordBrave = storageSnapshotRecord;
  }

  // Setting cookie Snapshot for Chrome

  setCookieSnapshotRecordChrome(
    cookieSnapshotRecord: Record<string, CookieSnapshot | null>
  ): void {
    this.#cookieSnapshotRecordChrome = cookieSnapshotRecord;
  }

  // Setting cookie Snapshot for brave

  setCookieSnapshotRecordBrave(
    cookieSnapshotRecord: Record<string, CookieSnapshot | null>
  ): void {
    this.#cookieSnapshotRecordBrave = cookieSnapshotRecord;
  }

  // Setting all the request urls and status codes Snapshot for Chrome

  setRequestCollectionChrome(requestCollection: CompactRequest[]): void {
    this.#requestCollectionChrome = requestCollection;
  }

  // Setting all the request urls and status codes Snapshot for brave

  setRequestCollectionBrave(requestCollection: CompactRequest[]): void {
    this.#requestCollectionBrave = requestCollection;
  }

  addError(error: AnalysisError) {
    this.#errorCollectionChrome.push(error);
    this.#errorCollectionBrave.push(error);
  }


  async persist(): Promise<void> {
    const compactLogfile: PACompactLogfile = {
      site: this.#site,
      trackingResultRecordChrome: this.#trackingResultRecordChrome,
      trackingResultRecordBrave: this.#trackingResultRecordBrave,
      storageSnapshotRecordChrome: this.#storageSnapshotRecordChrome,
      storageSnapshotRecordBrave: this.#storageSnapshotRecordBrave,
      cookieSnapshotRecordChrome: this.#cookieSnapshotRecordChrome,
      cookieSnapshotRecordBrave: this.#cookieSnapshotRecordBrave,
      requestCollectionChrome: this.#requestCollectionChrome,
      requestCollectionBrave: this.#requestCollectionBrave,
      errorCollectionChrome: this.#errorCollectionChrome,
      errorCollectionBrave: this.#errorCollectionBrave,
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
