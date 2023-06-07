import { Browser, Frame, Page, TimeoutError } from "puppeteer";
import { setupPageRequestInterceptor } from "./page-request-interceptor";
import AnalysisLogger from "./analysis-logger";
import assert, { AssertionError } from "assert";
import BrowserManager from "./browser-manager";
import {
  CompactTrackingResult,
  validateCompactTrackingResult,
  validateStorageSnapshot,
  StorageSnapshot,
  CookieSnapshot,
  CompactRequest,
} from "@yuantijs/core";

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

  // Taking StorageSnapshot in case of Chrome

  async #runSiteAnalysisCA(onSuccess?: () => Promise<void>): Promise<void> {
    let success: boolean = false;
    await this.#openPage(this.#browserManager.get("CA"), async (page) => {
      const getRequestCollection = await this.#startRequestRecording(page);
      await this.#navigate(page);
      await this.#delay();
      this.#logger.setStorageSnapshotRecordChrome(
        await this.#evaluateStorageSnapshotRecord(page)
      );
      this.#logger.setCookieSnapshotRecordBrave(
        await this.#evaluateCookieSnapshotRecord(page)
      );
      this.#logger.setRequestCollectionBrave(getRequestCollection());
      success = true;
    });

    if (success && onSuccess) {
      await onSuccess();
    }
  }

  // Taking snapshots in case of Brave

  async #runSiteAnalysisBA(): Promise<void> {
    await this.#openPage(this.#browserManager.get("BA"), async (page) => {
      const getRequestCollection = await this.#startRequestRecording(page);
      await this.#navigate(page);
      await this.#delay();
      this.#logger.setStorageSnapshotRecordBrave(
        await this.#evaluateStorageSnapshotRecord(page)
      );
      this.#logger.setCookieSnapshotRecordBrave(
        await this.#evaluateCookieSnapshotRecord(page)
      );
      this.#logger.setRequestCollectionBrave(getRequestCollection());
    });
  }

  // Taking Tracking flows in case of Chrome

  async #runSiteAnalysisCT(): Promise<void> {
    await this.#openPage(this.#browserManager.get("CT"), async (page) => {
      await setupPageRequestInterceptor(page, this.#logger);
      await this.#navigate(page, TIMEOUT_MS_T);
      await this.#delay(TIMEOUT_MS_DELAY_T);
      this.#logger.setTrackingResultRecordChrome(
        await this.#evaluateTrackingResultRecord(page)
      );
    });

    // this empty navigation should ensure that all cookies/storage items will be eventually set
    await this.#openPage(this.#browserManager.get("CT"), async (page) => {
      await this.#navigate(page);
      await this.#delay();
    });
  }

  // Taking Tracking flows in case of Brave

  async #runSiteAnalysisBT(): Promise<void> {
    await this.#openPage(this.#browserManager.get("BT"), async (page) => {
      await setupPageRequestInterceptor(page, this.#logger);
      await this.#navigate(page, TIMEOUT_MS_T);
      await this.#delay(TIMEOUT_MS_DELAY_T);
      this.#logger.setTrackingResultRecordBrave(
        await this.#evaluateTrackingResultRecord(page)
      );
    });

    // this empty navigation should ensure that all cookies/storage items will be eventually set
    await this.#openPage(this.#browserManager.get("BT"), async (page) => {
      await this.#navigate(page);
      await this.#delay();
    });
  }

  async runAnalysis() {
    await this.#runSiteAnalysisCA(async () => {
      await this.#runSiteAnalysisBA();
      await this.#runSiteAnalysisCT();
      await this.#runSiteAnalysisBT();
    });
  }
}

export default AnalysisRunner;
