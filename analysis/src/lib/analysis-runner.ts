import { Browser, Frame, Page, TimeoutError } from "puppeteer";
import { setupPageRequestInterceptor } from "./page-request-interceptor";
import AnalysisLogger from "./analysis-logger";
import assert, { AssertionError } from "assert";
import BrowserManager, { BrowserKey } from "./browser-manager";
import {
  CompactTrackingResult,
  validateCompactTrackingResult,
  validateStorageSnapshot,
  StorageSnapshot,
  CookieSnapshot,
  CompactRequest,
} from "@yuantijs/core";

interface AnalysisSpecA {
  browserKeyA: BrowserKey;
  setStorageSnapshotRecord(
    storageSnapshotRecord: Record<string, StorageSnapshot | null>
  ): void;
  setCookieSnapshotRecord(
    cookieSnapshotRecord: Record<string, CookieSnapshot | null>
  ): void;
  setRequestCollection(requestCollection: CompactRequest[]): void;
}

interface AnalysisSpecT {
  browserKeyT: BrowserKey;
  setTrackingResultRecord(
    trackingResultRecord: Record<string, CompactTrackingResult | null>
  ): void;
}

const TIMEOUT_MS = 30 * 1000;

const TIMEOUT_MS_T = 120 * 1000;

const TIMEOUT_MS_EVAL = 30 * 1000;

const TIMEOUT_MS_DELAY = 3 * 1000;

const TIMEOUT_MS_DELAY_T = 5 * 1000;

class AnalysisRunner {
  #url: string;
  #browserManager: BrowserManager;
  #logger: AnalysisLogger;

  constructor(
    url: string,
    browserManager: BrowserManager,
    logger: AnalysisLogger
  ) {
    this.#url = url;
    this.#browserManager = browserManager;
    this.#logger = logger;
  }

  async #openPage(
    browser: Browser,
    callback: (page: Page) => Promise<void>
  ): Promise<void> {
    const browserKey = this.#browserManager.getKeyOf(browser);
    console.log("begin openPage", browserKey);
    const page = await browser.newPage();
    try {
      await callback(page);
    } finally {
      await page.close();
      console.log("end openPage", browserKey);
    }
  }

  async #navigate(page: Page, timeoutMs?: number): Promise<void> {
    const url = this.#url;
    try {
      await page.goto(url, {
        waitUntil: "load",
        timeout: timeoutMs || TIMEOUT_MS,
      });
    } catch (e) {
      if (e instanceof TimeoutError) {
        this.#logger.addError({ type: "loading-timeout", url });
      } else {
        this.#logger.addError({
          type: "navigation-error",
          url,
          message: e instanceof Error ? e.toString() : "" + e,
        });
        throw e;
      }
    }
  }

  async #delay(timeoutMs?: number): Promise<void> {
    await new Promise((resolve) =>
      setTimeout(() => {
        resolve(undefined);
      }, timeoutMs || TIMEOUT_MS_DELAY)
    );
  }

  async #waitForFrameEvaluate(
    frame: Frame,
    pageFunction: string
  ): Promise<unknown> {
    try {
      return await Promise.race([
        frame.evaluate(pageFunction),
        new Promise((_, reject) =>
          setTimeout(() => reject(new TimeoutError()), TIMEOUT_MS_EVAL)
        ),
      ]);
    } catch (e) {
      if (e instanceof TimeoutError) {
        this.#logger.addError({ type: "evaluation-timeout" });
      } else {
        this.#logger.addError({
          type: "evaluation-error",
          message: e instanceof Error ? e.toString() : "" + e,
        });
      }
      throw e;
    }
  }

  async #evaluateTrackingResultRecord(
    page: Page
  ): Promise<Record<string, CompactTrackingResult | null>> {
    try {
      const result: Record<string, CompactTrackingResult | null> = {};
      for (const frame of page.frames()) {
        if (frame.isDetached()) continue;
        const url = (() => {
          try {
            return new URL(frame.url());
          } catch (e) {
            return null;
          }
        })();
        if (!url) continue;
        const urlString = url.toString();
        if (urlString in result) continue;
        const evaled = await this.#waitForFrameEvaluate(
          frame,
          `window.__ytjs_getTrackingResult && window.__ytjs_getTrackingResult()`
        );
        if (evaled) {
          assert(
            validateCompactTrackingResult(evaled),
            `evaled is not a CompactTrackingResult: ${JSON.stringify(evaled)}`
          );
          result[urlString] = evaled;
        } else {
          result[urlString] = null;
        }
      }
      return result;
    } catch (e) {
      if (e instanceof AssertionError) {
        this.#logger.addError({
          type: "assertion-error",
          message: e.message,
        });
      }
      throw e;
    }
  }

  async #evaluateStorageSnapshotRecord(
    page: Page
  ): Promise<Record<string, StorageSnapshot>> {
    try {
      const result: Record<string, StorageSnapshot> = {};
      for (const frame of page.frames()) {
        if (frame.isDetached()) continue;
        const url = (() => {
          try {
            return new URL(frame.url());
          } catch (e) {
            return null;
          }
        })();
        if (!url) continue;
        const origin = url.origin;
        if (origin in result) continue;
        const evaled = await this.#waitForFrameEvaluate(
          frame,
          `(function () {
  const Storage = window.Storage;
  function takeSnapshot(storage) {
    const snapshot = {};
    for (let i = 0, key; key = Storage.prototype.key.call(storage, i); ++i) {
      snapshot[key] = Storage.prototype.getItem.call(storage, key);
    }
    return snapshot;
  }
  return { localStorage: takeSnapshot(window.localStorage), sessionStorage: takeSnapshot(window.sessionStorage) };
})()`
        );
        assert(
          validateStorageSnapshot(evaled),
          `evaled is not a StorageSnapshot: ${JSON.stringify(evaled)}`
        );
        result[origin] = evaled;
      }
      return result;
    } catch (e) {
      if (e instanceof AssertionError) {
        this.#logger.addError({
          type: "assertion-error",
          message: e.message,
        });
      }
      throw e;
    }
  }

  // Collecting the first and third party cookies.

  async #evaluateCookieSnapshotRecord(
    page: Page
  ): Promise<Record<string, CookieSnapshot>> {
    const result: Record<string, CookieSnapshot> = {};

    for (const frame of page.frames()) {
      const url = (() => {
        try {
          return new URL(frame.url());
        } catch (e) {
          return null;
        }
      })();
      if (!url) continue;
      const origin = url.origin;
      if (origin in result) continue;
      const cookies = await page.cookies(origin);
      result[origin] = Object.fromEntries(
        cookies.map((cookie) => [cookie.name, cookie.value])
      );
    }

    return result;
  }

  // Capturing all the Web request urls a site made and their respective status codes.

  async #startRequestRecording(page: Page): Promise<() => CompactRequest[]> {
    const requests: CompactRequest[] = [];

    await page.setRequestInterception(true);

    page.on("request", (request) => {
      request.continue();
    });

    page.on("response", (response) => {
      requests.push({ url: response.url(), status: response.status() });
    });

    return () => [...requests];
  }

  async #runSiteAnalysisA(analysisSpecA: AnalysisSpecA): Promise<void> {
    await this.#openPage(
      this.#browserManager.get(analysisSpecA.browserKeyA),
      async (page) => {
        const getRequestCollection = await this.#startRequestRecording(page);
        await this.#navigate(page);
        await this.#delay();
        analysisSpecA.setStorageSnapshotRecord(
          await this.#evaluateStorageSnapshotRecord(page)
        );
        analysisSpecA.setCookieSnapshotRecord(
          await this.#evaluateCookieSnapshotRecord(page)
        );
        analysisSpecA.setRequestCollection(getRequestCollection());
      }
    );
  }

  async #runSiteAnalysisT(analysisSpecT: AnalysisSpecT): Promise<void> {
    const browser = this.#browserManager.get(analysisSpecT.browserKeyT);

    await this.#openPage(browser, async (page) => {
      await setupPageRequestInterceptor(page, this.#logger);
      await this.#navigate(page, TIMEOUT_MS_T);
      await this.#delay(TIMEOUT_MS_DELAY_T);
      this.#logger.setTrackingResultRecordChrome(
        await this.#evaluateTrackingResultRecord(page)
      );
    });

    // this empty navigation should ensure that all cookies/storage items will be eventually set
    await this.#openPage(browser, async (page) => {
      await this.#navigate(page);
      await this.#delay();
    });
  }

  async runAnalysis() {
    const chromeAnalysisSpecA: AnalysisSpecA = {
      browserKeyA: "CA",
      setStorageSnapshotRecord: (storageSnapshotRecord) => {
        this.#logger.setStorageSnapshotRecordChrome(storageSnapshotRecord);
      },
      setCookieSnapshotRecord: (cookieSnapshotRecord) => {
        this.#logger.setCookieSnapshotRecordChrome(cookieSnapshotRecord);
      },
      setRequestCollection: (requestCollection) => {
        this.#logger.setRequestCollectionChrome(requestCollection);
      },
    };

    const chromeAnalysisSpecT: AnalysisSpecT = {
      browserKeyT: "CT",
      setTrackingResultRecord: (trackingResultRecord) => {
        this.#logger.setTrackingResultRecordChrome(trackingResultRecord);
      },
    };

    const braveAnalysisSpecA: AnalysisSpecA = {
      browserKeyA: "BA",
      setStorageSnapshotRecord: (storageSnapshotRecord) => {
        this.#logger.setStorageSnapshotRecordBrave(storageSnapshotRecord);
      },
      setCookieSnapshotRecord: (cookieSnapshotRecord) => {
        this.#logger.setCookieSnapshotRecordBrave(cookieSnapshotRecord);
      },
      setRequestCollection: (requestCollection) => {
        this.#logger.setRequestCollectionBrave(requestCollection);
      },
    };

    const braveAnalysisSpecT: AnalysisSpecT = {
      browserKeyT: "BT",
      setTrackingResultRecord: (trackingResultRecord) => {
        this.#logger.setTrackingResultRecordBrave(trackingResultRecord);
      },
    };

    await this.#runSiteAnalysisA(chromeAnalysisSpecA);
    await Promise.allSettled([
      this.#runSiteAnalysisA(braveAnalysisSpecA),
      this.#runSiteAnalysisT(chromeAnalysisSpecT),
      this.#runSiteAnalysisT(braveAnalysisSpecT),
    ]);
  }
}

export default AnalysisRunner;
