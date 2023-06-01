import * as fsPromises from "fs/promises";
import path from "path";
import {
  AnalysisError,
  CompactTrackingResult,
  CompactLogfile,
  StorageSnapshot,
} from "@yuantijs/core";

class AnalysisLogger {
  #analysisName: string;
  #site: string;
  #trackingResultRecordChrome: Record<string, CompactTrackingResult | null>;
  #trackingResultRecordBrave: Record<string, CompactTrackingResult | null>;
  // storageSnapshotRecordA is for Chrome
  #storageSnapshotRecordA: Record<string, StorageSnapshot | null>;   
   // storageSnapshotRecordB1 is for Chrome
  #storageSnapshotRecordB1: Record<string, StorageSnapshot | null>;
  #cookieSnapshotRecordChrome: Record<string, StorageSnapshot | null>;
  #cookieSnapshotRecordBrave: Record<string, StorageSnapshot | null>;
  #requestSnapshotRecordChrome: Record<string, StorageSnapshot | null>;
  #requestSnapshotRecordBrave: Record<string, StorageSnapshot | null>;
  #errorCollection: AnalysisError[];

  constructor(analysisName: string, site: string) {
    this.#analysisName = analysisName;
    this.#site = site;
    this.#trackingResultRecordChrome = {};
    this.#trackingResultRecordBrave = {};
    this.#storageSnapshotRecordA = {};
    this.#storageSnapshotRecordB1 = {};
    this.#cookieSnapshotRecordChrome = {};
    this.#cookieSnapshotRecordBrave = {};
    this.#requestSnapshotRecordChrome = {};
    this.#requestSnapshotRecordBrave = {};
    this.#errorCollection = [];
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
    storageSnapshotCollection: Record<string, StorageSnapshot | null>
  ): void {
    this.#storageSnapshotRecordA = storageSnapshotCollection;
  }

  setStorageSnapshotCollectionBrave(
    storageSnapshotCollection: Record<string, StorageSnapshot | null>
  ): void {
    this.#storageSnapshotRecordB1 = storageSnapshotCollection;
  }

  // Setting cookie Snapshot for Chrome

  setCookieSnapshotCollectionChrome(
    cookieSnapshotCollection: Record<string, CookieSnapshot | null>
  ): void {
    this.#cookieSnapshotRecordChrome = cookieSnapshotCollection;
  }

    // Setting cookie Snapshot for brave

  setCookieSnapshotCollectionBrave(
    cookieSnapshotCollection: Record<string, CookieSnapshot | null>
  ): void {
    this.#cookieSnapshotRecordBrave = cookieSnapshotCollection;
  }

   // Setting all the request urls and status codes Snapshot for Chrome


  setRequestSnapshotCollectionChrome(
    requestSnapshotCollection: Record<string, RequestSnapshot | null>
  ): void {
    this.#requestSnapshotRecordChrome = requestSnapshotCollection;
  }

    // Setting all the request urls and status codes Snapshot for brave

  setRequestSnapshotCollectionBrave(
    requestSnapshotCollection: Record<string, RequestSnapshot | null>
  ): void {
    this.#requestSnapshotRecordBrave = requestSnapshotCollection;
  }

  addError(error: AnalysisError) {
    this.#errorCollection.push(error);
  }

  async persist(): Promise<void> {
    const compactLogfile: CompactLogfile = {
      site: this.#site,
      trackingResultRecordChrome: this.#trackingResultRecordChrome,
      trackingResultRecordBrave: this.#trackingResultRecordBrave,
      storageSnapshotRecordA: this.#storageSnapshotRecordA,
      storageSnapshotRecordB1: this.#storageSnapshotRecordB1,
      cookieSnapshotRecordChrome: this.#cookieSnapshotRecordChrome,
      cookieSnapshotRecordBrave: this.#cookieSnapshotRecordBrave,
      requestSnapshotRecordChrome: this.#requestSnapshotRecordChrome,
      requestSnapshotRecordBrave: this.#requestSnapshotRecordBrave,
      errorCollection: this.#errorCollection,
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
