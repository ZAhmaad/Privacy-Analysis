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
  #storageSnapshotRecordA: Record<string, StorageSnapshot | null>;
  #cookieSnapshotRecordA: Record<string, CookieSnapshot | null>;
  #storageSnapshotRecordB: Record<string, StorageSnapshot | null>;
  #cookieSnapshotRecordB: Record<string, CookieSnapshot | null>;
  #requestCollection: CompactRequest[];
  #errorCollection: AnalysisError[];

  constructor() {
    this.#trackingResultRecord = {};
    this.#storageSnapshotRecord = {};
    this.#cookieSnapshotRecord = {};
    this.#storageSnapshotRecordA = {};
    this.#cookieSnapshotRecordA = {};
    this.#storageSnapshotRecordB = {};
    this.#cookieSnapshotRecordB = {};
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


  setStorageSnapshotRecordA(
    storageSnapshotRecord: Record<string, StorageSnapshot | null>
  ): void {
    this.#storageSnapshotRecordA = storageSnapshotRecord;
  }

  setCookieSnapshotRecordA(
    cookieSnapshotRecord: Record<string, CookieSnapshot | null>
  ): void {
    this.#cookieSnapshotRecordA = cookieSnapshotRecord;
  }


  
  setStorageSnapshotRecordB(
    storageSnapshotRecord: Record<string, StorageSnapshot | null>
  ): void {
    this.#storageSnapshotRecordB = storageSnapshotRecord;
  }

  setCookieSnapshotRecordB(
    cookieSnapshotRecord: Record<string, CookieSnapshot | null>
  ): void {
    this.#cookieSnapshotRecordB = cookieSnapshotRecord;
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
      storageSnapshotRecordA: this.#storageSnapshotRecordA,
      storageSnapshotRecordB: this.#storageSnapshotRecordB,
      cookieSnapshotRecord: this.#cookieSnapshotRecord,
      storageSnapshotRecord: this.#storageSnapshotRecord,
      cookieSnapshotRecordA: this.#cookieSnapshotRecordA,
      cookieSnapshotRecordB: this.#cookieSnapshotRecordB,
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
  safariAnalysisLogger: BrowserAnalysisLogger;
  firefoxAnalysisLogger: BrowserAnalysisLogger;

  constructor(analysisName: string, site: string) {
    this.#analysisName = analysisName;
    this.#site = site;
    this.chromeAnalysisLogger = new BrowserAnalysisLogger();
    this.braveAnalysisLogger = new BrowserAnalysisLogger();
    this.safariAnalysisLogger = new BrowserAnalysisLogger();
    this.firefoxAnalysisLogger = new BrowserAnalysisLogger();
  }

  async persist(): Promise<void> {
    const compactLogfile: PACompactLogfile = {
      site: this.#site,
      chrome: this.chromeAnalysisLogger.getCompactBrowserLogfile(),
      brave: this.braveAnalysisLogger.getCompactBrowserLogfile(),
      safari: this.safariAnalysisLogger.getCompactBrowserLogfile(),
      firefox: this.firefoxAnalysisLogger.getCompactBrowserLogfile(),
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
