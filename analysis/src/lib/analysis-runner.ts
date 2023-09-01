import { BrowserContext as Browser, Frame, Page } from "playwright";
import { errors } from "playwright";

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

  addError: AddErrorCallback;
}

interface AnalysisSpecT {
  browserKeyT: BrowserKey;
  setTrackingResultRecord(
    trackingResultRecord: Record<string, CompactTrackingResult | null>
  ): void;
  setStorageSnapshotRecord(
    storageSnapshotRecord: Record<string, StorageSnapshot | null>
  ): void;
  setCookieSnapshotRecord(
    cookieSnapshotRecord: Record<string, CookieSnapshot | null>
  ): void;
  setRequestCollection(requestCollection: CompactRequest[]): void;
  addError: AddErrorCallback;
}

type AddErrorCallback = (error: AnalysisError) => void;

const TIMEOUT_MS = 240 * 1000;

const TIMEOUT_MS_T = 240 * 1000;

const TIMEOUT_MS_EVAL = 60 * 1000;

const TIMEOUT_MS_DELAY = 5 * 1000;

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
      if (e instanceof errors.TimeoutError) {
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
          setTimeout(() => reject(new errors.TimeoutError()), TIMEOUT_MS_EVAL)
        ),
      ]);
    } catch (e) {
      if (e instanceof errors.TimeoutError) {
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
      const cookies = await page.context().cookies(origin);
      result[origin] = Object.fromEntries(
        cookies.map((cookie) => [cookie.name, cookie.value])
      );
    }

    return result;
  }

  // Capturing all the Web request urls a site made and their respective status codes.

  async #startRequestRecording(page: Page): Promise<() => CompactRequest[]> {
    const requests: CompactRequest[] = [];

    await page.route("**", (route: any) => {
      route.continue();
    });

    page.on("response", (response) => {
      const request = response.request();
      requests.push({
        url: response.url(),
        status: response.status(),
        type: request.resourceType(),
        postData: request.postData() ?? undefined,
      });
    });

    return () => [...requests];
  }

  async #runSiteAnalysisA(analysisSpecA: AnalysisSpecA): Promise<void> {
    const addError: AddErrorCallback = (error) => {
      analysisSpecA.addError({
        ...error,
        browserKey: analysisSpecA.browserKeyA,
      });
    };
    await this.#openPage(
      this.#browserManager.get(analysisSpecA.browserKeyA),
      async (page) => {
        await this.#navigate(page, addError);
        await this.#delay();
        analysisSpecA.setStorageSnapshotRecord(
          await this.#evaluateStorageSnapshotRecord(page, addError)
        );
        analysisSpecA.setCookieSnapshotRecord(
          await this.#evaluateCookieSnapshotRecord(page)
        );
      }
    );
  }

  async #runSiteAnalysisT(analysisSpecT: AnalysisSpecT): Promise<void> {
    const addError: AddErrorCallback = (error) => {
      analysisSpecT.addError({
        ...error,
        browserKey: analysisSpecT.browserKeyT,
      });
    };

    const browser = this.#browserManager.get(analysisSpecT.browserKeyT);

    await this.#openPage(browser, async (page) => {
      const getRequestCollection = await this.#startRequestRecording(page);
      await setupPageRequestInterceptor(page, (error) => {
        addError(error);
      });
      await this.#navigate(page, addError, TIMEOUT_MS_T);
      await this.#delay(TIMEOUT_MS_DELAY_T);
      analysisSpecT.setTrackingResultRecord(
        await this.#evaluateTrackingResultRecord(page, addError)
      );

      analysisSpecT.setStorageSnapshotRecord(
        await this.#evaluateStorageSnapshotRecord(page, addError)
      );
      analysisSpecT.setCookieSnapshotRecord(
        await this.#evaluateCookieSnapshotRecord(page)
      );
      analysisSpecT.setRequestCollection(getRequestCollection());
    });

    // this empty navigation should ensure that all cookies/storage items will be eventually set
    await this.#openPage(browser, async (page) => {
      await this.#navigate(page, addError);
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
        this.#logger.chromeAnalysisLogger.setStorageSnapshotRecordA(
          storageSnapshotRecord
        );
      },
      setCookieSnapshotRecord: (cookieSnapshotRecord) => {
        this.#logger.chromeAnalysisLogger.setCookieSnapshotRecordA(
          cookieSnapshotRecord
        );
      },
      addError: cAddError,
    };

    const cbAnalysisSpec: AnalysisSpecA = {
      browserKeyA: "CB",
      setStorageSnapshotRecord: (storageSnapshotRecord) => {
        this.#logger.chromeAnalysisLogger.setStorageSnapshotRecordB(
          storageSnapshotRecord
        );
      },
      setCookieSnapshotRecord: (cookieSnapshotRecord) => {
        this.#logger.chromeAnalysisLogger.setCookieSnapshotRecordB(
          cookieSnapshotRecord
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

    const bAddError = (error: AnalysisError) => {
      this.#logger.braveAnalysisLogger.addError(error);
    };

    const baAnalysisSpec: AnalysisSpecA = {
      browserKeyA: "BA",
      setStorageSnapshotRecord: (storageSnapshotRecord) => {
        this.#logger.braveAnalysisLogger.setStorageSnapshotRecordA(
          storageSnapshotRecord
        );
      },
      setCookieSnapshotRecord: (cookieSnapshotRecord) => {
        this.#logger.braveAnalysisLogger.setCookieSnapshotRecordA(
          cookieSnapshotRecord
        );
      },
      addError: bAddError,
    };

    const bbAnalysisSpec: AnalysisSpecA = {
      browserKeyA: "BB",
      setStorageSnapshotRecord: (storageSnapshotRecord) => {
        this.#logger.braveAnalysisLogger.setStorageSnapshotRecordB(
          storageSnapshotRecord
        );
      },
      setCookieSnapshotRecord: (cookieSnapshotRecord) => {
        this.#logger.braveAnalysisLogger.setCookieSnapshotRecordB(
          cookieSnapshotRecord
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

    const sAddError = (error: AnalysisError) => {
      this.#logger.safariAnalysisLogger.addError(error);
    };

    const saAnalysisSpec: AnalysisSpecA = {
      browserKeyA: "SA",
      setStorageSnapshotRecord: (storageSnapshotRecord) => {
        this.#logger.safariAnalysisLogger.setStorageSnapshotRecordA(
          storageSnapshotRecord
        );
      },
      setCookieSnapshotRecord: (cookieSnapshotRecord) => {
        this.#logger.safariAnalysisLogger.setCookieSnapshotRecordA(
          cookieSnapshotRecord
        );
      },
      addError: sAddError,
    };

    const sbAnalysisSpec: AnalysisSpecA = {
      browserKeyA: "SB",
      setStorageSnapshotRecord: (storageSnapshotRecord) => {
        this.#logger.safariAnalysisLogger.setStorageSnapshotRecordB(
          storageSnapshotRecord
        );
      },
      setCookieSnapshotRecord: (cookieSnapshotRecord) => {
        this.#logger.safariAnalysisLogger.setCookieSnapshotRecordB(
          cookieSnapshotRecord
        );
      },
      addError: sAddError,
    };

    const stAnalysisSpec: AnalysisSpecT = {
      browserKeyT: "ST",
      setTrackingResultRecord: (trackingResultRecord) => {
        this.#logger.safariAnalysisLogger.setTrackingResultRecord(
          trackingResultRecord
        );
      },

      setStorageSnapshotRecord: (storageSnapshotRecord) => {
        this.#logger.safariAnalysisLogger.setStorageSnapshotRecord(
          storageSnapshotRecord
        );
      },
      setCookieSnapshotRecord: (cookieSnapshotRecord) => {
        this.#logger.safariAnalysisLogger.setCookieSnapshotRecord(
          cookieSnapshotRecord
        );
      },
      setRequestCollection: (requestCollection) => {
        this.#logger.safariAnalysisLogger.setRequestCollection(
          requestCollection
        );
      },
      addError: sAddError,
    };

    const fAddError = (error: AnalysisError) => {
      this.#logger.firefoxAnalysisLogger.addError(error);
    };

    const faAnalysisSpec: AnalysisSpecA = {
      browserKeyA: "FA",
      setStorageSnapshotRecord: (storageSnapshotRecord) => {
        this.#logger.firefoxAnalysisLogger.setStorageSnapshotRecordA(
          storageSnapshotRecord
        );
      },
      setCookieSnapshotRecord: (cookieSnapshotRecord) => {
        this.#logger.firefoxAnalysisLogger.setCookieSnapshotRecordA(
          cookieSnapshotRecord
        );
      },
      addError: fAddError,
    };

    const fbAnalysisSpec: AnalysisSpecA = {
      browserKeyA: "FB",
      setStorageSnapshotRecord: (storageSnapshotRecord) => {
        this.#logger.firefoxAnalysisLogger.setStorageSnapshotRecordB(
          storageSnapshotRecord
        );
      },
      setCookieSnapshotRecord: (cookieSnapshotRecord) => {
        this.#logger.firefoxAnalysisLogger.setCookieSnapshotRecordB(
          cookieSnapshotRecord
        );
      },
      addError: fAddError,
    };

    const ftAnalysisSpec: AnalysisSpecT = {
      browserKeyT: "FT",
      setTrackingResultRecord: (trackingResultRecord) => {
        this.#logger.firefoxAnalysisLogger.setTrackingResultRecord(
          trackingResultRecord
        );
      },

      setStorageSnapshotRecord: (storageSnapshotRecord) => {
        this.#logger.firefoxAnalysisLogger.setStorageSnapshotRecord(
          storageSnapshotRecord
        );
      },
      setCookieSnapshotRecord: (cookieSnapshotRecord) => {
        this.#logger.firefoxAnalysisLogger.setCookieSnapshotRecord(
          cookieSnapshotRecord
        );
      },
      setRequestCollection: (requestCollection) => {
        this.#logger.firefoxAnalysisLogger.setRequestCollection(
          requestCollection
        );
      },
      addError: fAddError,
    };

    // await this.#runSiteAnalysisA(caAnalysisSpec);
    await Promise.allSettled([
      this.#runSiteAnalysisA(baAnalysisSpec),
      this.#runSiteAnalysisA(caAnalysisSpec),
      this.#runSiteAnalysisA(bbAnalysisSpec),
      this.#runSiteAnalysisA(cbAnalysisSpec),
      this.#runSiteAnalysisT(ctAnalysisSpec),
      this.#runSiteAnalysisT(btAnalysisSpec),
      this.#runSiteAnalysisA(saAnalysisSpec),
      this.#runSiteAnalysisA(sbAnalysisSpec),
      this.#runSiteAnalysisT(stAnalysisSpec),
      this.#runSiteAnalysisA(faAnalysisSpec),
      this.#runSiteAnalysisA(fbAnalysisSpec),
      this.#runSiteAnalysisT(ftAnalysisSpec),
    ]);
  }
}

export default AnalysisRunner;
