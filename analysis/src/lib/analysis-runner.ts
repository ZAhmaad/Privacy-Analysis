import { Browser, Frame, Page, TimeoutError, HTTPResponse } from "puppeteer";
import { NetworkInterceptor, Request } from 'puppeteer-network-interception';
import { setupPageRequestInterceptor } from "./page-request-interceptor";
import AnalysisLogger from "./analysis-logger";
import assert, { AssertionError } from "assert";
import BrowserManager from "./browser-manager";
import {
  CompactTrackingResult,
  validateCompactTrackingResult,
  validateStorageSnapshot,
  StorageSnapshot,
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



//  Capturing all the Web request urls a site made and their respective status codes. I didn't test it. 
// This need to be checked and tested
  
  async #captureRequestURLsWithStatusCode(
    page: Page
  ) : Promise<Record<string, RequestSnapshot>> {
    
  
    // Enable request interception
    const interceptor = new NetworkInterceptor(page);
    await interceptor.enable();
  
    // Create an empty array to store the captured requests
    const capturedRequests: { url: string; status: number | null }[] = [];
  
    // Listen for all requests and store their URLs and status codes
    interceptor.on('request', (request: Request) => {
      capturedRequests.push({
        url: request.url(),
        status: null, // Will be filled later with the status code
      });
  
      request.continue();
    });
  
    // Listen for the response and update the status code
    interceptor.on('response', (response: HTTPResponse) => {
      const index = capturedRequests.findIndex((request) => request.url === response.url());
      if (index !== -1) {
        capturedRequests[index].status = response.status();
      }
    });
  

  }


// Collecting the first and third party cookies. This needs to checked and tested.

async #evaluateCookieSnapshotRecord(page:Page): Promise<Record<string, CookieSnapshot>> {
  const result: Record<string, CookieSnapshot> = {};
  
  // Enable request interception
  await page.setRequestInterception(true);

  // Create a Set to store unique domains
  const domains = new Set<string>();

  // Listen to requests
  page.on('request', (interceptedRequest) => {
    const url = interceptedRequest.url();
    const isThirdParty = !url.includes(page.url());

    if (isThirdParty) {
      const domain = new URL(url).hostname;
      domains.add(domain);
    }

    interceptedRequest.continue();
  });

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
    const evaled = await frame.evaluate(() => {
      const cookies = document.cookie.split(';').map(cookie => cookie.trim());
      const snapshot = {};
      for (const cookie of cookies) {
        const [name, value] = cookie.split('=');
        snapshot[name] = value;
      }
      return snapshot;
    });
    result[origin] = evaled;
  }

  // Collect third-party cookies
  const thirdPartyCookies = await Promise.all(
    Array.from(domains).map(async (domain) => {
      const cookies = await page.cookies(`https://${domain}`);
      return { domain, cookies };
    })
  );

 

  return result;
}

  

  
  




  

  // Taking StorageSnapShot in case of Chrome

  async #runSiteAnalysisCA(onSuccess?: () => Promise<void>): Promise<void> {
    const thisRunner = this;

    let success: boolean = false;
    await this.#openPage(this.#browserManager.get("CA"), async function (page) {
      await thisRunner.#navigate(page);
      await thisRunner.#delay();
      thisRunner.#logger.setStorageSnapshotRecordA(
        await thisRunner.#evaluateStorageSnapshotRecord(page)
      );
      success = true;
    });

    if (success && onSuccess) {
      await onSuccess();
    }
  }


    // Taking StorageSnapShot in case of Brave

  async #runSiteAnalysisBA(): Promise<void> {
    const thisRunner = this;

    await this.#openPage(this.#browserManager.get("BA"), async function (page) {
      await thisRunner.#navigate(page);
      await thisRunner.#delay();
      thisRunner.#logger.setStorageSnapshotCollectionB1(
        await thisRunner.#evaluateStorageSnapshotRecord(page)
      );
    });

    // await this.#openPage(this.#browserManager.get("B"), async function (page) {
    //   await thisRunner.#navigate(page);
    //   await thisRunner.#delay();
    //   thisRunner.#logger.setStorageSnapshotCollectionB2(
    //     await thisRunner.#evaluateStorageSnapshotRecord(page)
    //   );
    // });
  }


    // Taking Tracking flows in case of Chrome

  async #runSiteAnalysisCT(): Promise<void> {
    const thisRunner = this;

    await this.#openPage(this.#browserManager.get("CT"), async function (page) {
      await setupPageRequestInterceptor(page, thisRunner.#logger);
      await thisRunner.#navigate(page, TIMEOUT_MS_T);
      await thisRunner.#delay(TIMEOUT_MS_DELAY_T);
      thisRunner.#logger.setTrackingResultRecord(
        await thisRunner.#evaluateTrackingResultRecord(page)
      );
    });

    // this empty navigation should ensure that all cookies/storage items will be eventually set
    await this.#openPage(this.#browserManager.get("CT"), async function (page) {
      await thisRunner.#navigate(page);
      await thisRunner.#delay();
    });

  }


  // Taking Tracking flows in case of Brave

  async #runSiteAnalysisBT(): Promise<void> {
    const thisRunner = this;

    await this.#openPage(this.#browserManager.get("BT"), async function (page) {
      await setupPageRequestInterceptor(page, thisRunner.#logger);
      await thisRunner.#navigate(page, TIMEOUT_MS_T);
      await thisRunner.#delay(TIMEOUT_MS_DELAY_T);
      thisRunner.#logger.setTrackingResultRecord(
        await thisRunner.#evaluateTrackingResultRecord(page)
      );
    });

    // this empty navigation should ensure that all cookies/storage items will be eventually set
    await this.#openPage(this.#browserManager.get("BT"), async function (page) {
      await thisRunner.#navigate(page);
      await thisRunner.#delay();
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
