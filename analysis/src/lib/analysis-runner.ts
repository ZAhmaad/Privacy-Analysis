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
  AnalysisError,
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
  addError: AddErrorCallback;
}

interface AnalysisSpecT {
  browserKeyT: BrowserKey;
  setTrackingResultRecord(
    trackingResultRecord: Record<string, CompactTrackingResult | null>
  ): void;
  addError: AddErrorCallback;
}

type AddErrorCallback = (error: AnalysisError) => void;

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

  async #navigate(
    page: Page,
    addError: AddErrorCallback,
    timeoutMs?: number
  ): Promise<void> {
    const url = this.#url;
    try {
      await page.goto(url, {
        waitUntil: "load",
        timeout: timeoutMs || TIMEOUT_MS,
      });
    } catch (e) {
      if (e instanceof TimeoutError) {
        addError({ type: "loading-timeout", url });
      } else {
        addError({
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
    pageFunction: string,
    addError: AddErrorCallback
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
        addError({ type: "evaluation-timeout" });
      } else {
        addError({
          type: "evaluation-error",
          message: e instanceof Error ? e.toString() : "" + e,
        });
      }
      throw e;
    }
  }

  async #evaluateTrackingResultRecord(
    page: Page,
    addError: AddErrorCallback
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
          `window.__ytjs_getTrackingResult && window.__ytjs_getTrackingResult()`,
          addError
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
        addError({
          type: "assertion-error",
          message: e.message,
        });
      }
      throw e;
    }
  }

  async #evaluateStorageSnapshotRecord(
    page: Page,
    addError: AddErrorCallback
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
        if (origin === "null") continue;
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
})()`,
          addError
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
        addError({
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
      if (origin === "null") continue;
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
      const request = response.request();
      requests.push({
        url: response.url(),
        status: response.status(),
        type: request.resourceType(),
        initiator: request.initiator(),
      });
    });

    return () => [...requests];
  }

  async #runSiteAnalysisA(analysisSpecA: AnalysisSpecA): Promise<void> {
    await this.#openPage(
      this.#browserManager.get(analysisSpecA.browserKeyA),
      async (page) => {
        const getRequestCollection = await this.#startRequestRecording(page);
        await this.#navigate(page, analysisSpecA.addError);
        await this.#delay();
        analysisSpecA.setStorageSnapshotRecord(
          await this.#evaluateStorageSnapshotRecord(
            page,
            analysisSpecA.addError
          )
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
      await setupPageRequestInterceptor(page, (error) => {
        analysisSpecT.addError(error);
      });
      await this.#navigate(page, analysisSpecT.addError, TIMEOUT_MS_T);
      await this.#delay(TIMEOUT_MS_DELAY_T);
      analysisSpecT.setTrackingResultRecord(
        await this.#evaluateTrackingResultRecord(page, analysisSpecT.addError)
      );
    });

    // this empty navigation should ensure that all cookies/storage items will be eventually set
    await this.#openPage(browser, async (page) => {
      await this.#navigate(page, analysisSpecT.addError);
      await this.#delay();
    });
  }

  async runAnalysis() {
    const cAddError = (error: AnalysisError) => {
      this.#logger.chromeAnalysisLogger.addError(error);
    };

    const caAnalysisSpec: AnalysisSpecA = {
      browserKeyA: "CA",
      setStorageSnapshotRecord: (storageSnapshotRecord) => {
        this.#logger.chromeAnalysisLogger.setStorageSnapshotRecord(
          storageSnapshotRecord
        );
      },
      setCookieSnapshotRecord: (cookieSnapshotRecord) => {
        this.#logger.chromeAnalysisLogger.setCookieSnapshotRecord(
          cookieSnapshotRecord
        );
      },
      setRequestCollection: (requestCollection) => {
        this.#logger.chromeAnalysisLogger.setRequestCollection(
          requestCollection
        );
      },
      addError: cAddError,
    };

    const ctAnalysisSpec: AnalysisSpecT = {
      browserKeyT: "CT",
      setTrackingResultRecord: (trackingResultRecord) => {
        this.#logger.chromeAnalysisLogger.setTrackingResultRecord(
          trackingResultRecord
        );
      },
      addError: cAddError,
    };

    const bAddError = (error: AnalysisError) => {
      this.#logger.braveAnalysisLogger.addError(error);
    };

    const baAnalysisSpec: AnalysisSpecA = {
      browserKeyA: "BA",
      setStorageSnapshotRecord: (storageSnapshotRecord) => {
        this.#logger.braveAnalysisLogger.setStorageSnapshotRecord(
          storageSnapshotRecord
        );
      },
      setCookieSnapshotRecord: (cookieSnapshotRecord) => {
        this.#logger.braveAnalysisLogger.setCookieSnapshotRecord(
          cookieSnapshotRecord
        );
      },
      setRequestCollection: (requestCollection) => {
        this.#logger.braveAnalysisLogger.setRequestCollection(
          requestCollection
        );
      },
      addError: bAddError,
    };

    const btAnalysisSpec: AnalysisSpecT = {
      browserKeyT: "BT",
      setTrackingResultRecord: (trackingResultRecord) => {
        this.#logger.braveAnalysisLogger.setTrackingResultRecord(
          trackingResultRecord
        );
      },
      addError: bAddError,
    };

    await this.#runSiteAnalysisA(caAnalysisSpec);
    await Promise.allSettled([
      this.#runSiteAnalysisA(baAnalysisSpec),
      this.#runSiteAnalysisT(ctAnalysisSpec),
      this.#runSiteAnalysisT(btAnalysisSpec),
    ]);
  }
}

export default AnalysisRunner;
