import assert from "assert";
import path from "path";
import { chromium, BrowserContext as Browser, webkit, firefox } from "playwright";
 import * as env from "../env.json";

// Define four browsers: CA and CT are for Chrome and BA and BT are brave
type BrowserStore = {
  CA: Browser;
  CB: Browser;
  CT: Browser;
  BA: Browser;
  BB: Browser;
  BT: Browser;
  SA: Browser;
  SB: Browser;
  ST: Browser;
  FA: Browser;
  FB: Browser;
  FT: Browser;
};
type BrowserKey = keyof BrowserStore;

export { BrowserKey };

class BrowserManager {
  #browsers: BrowserStore | null;

  constructor() {
    this.#browsers = null;
  }

  get(key: BrowserKey) {
    assert(
      this.#browsers,
      "Browsers have not been launched, launch them with .launchAll() first"
    );
    return this.#browsers[key];
  }

  getKeyOf(browser: Browser): BrowserKey {
    assert(
      this.#browsers,
      "Browsers have not been launched, launch them with .launchAll() first"
    );
    const entry = Object.entries(this.#browsers).find(
      ([_, entryBrowser]) => browser === entryBrowser
    );
    if (entry) {
      return entry[0] as BrowserKey;
    } else {
      throw new Error("Unknown browser ID");
    }
  }

  async launchAll() {
    if (this.#browsers) return;
    this.#browsers = {
      CT: await this.#launchBrowserChrome("CT"),
      CA: await this.#launchBrowserChrome("CA"),
      CB: await this.#launchBrowserChrome("CB"),
      BT: await this.#launchBrowserBrave("BT"),
      BA: await this.#launchBrowserBrave("BA"),
      BB: await this.#launchBrowserBrave("BB"),
      ST: await this.#launchBrowserSafari("ST"),
      SA: await this.#launchBrowserSafari("SA"),
      SB: await this.#launchBrowserSafari("SB"),
      FT: await this.#launchBrowserFirefox("FT"),
      FA: await this.#launchBrowserFirefox("FA"),
      FB: await this.#launchBrowserFirefox("FB"),

    };
  }

  async closeAll() {
    if (!this.#browsers) return;
    for (const key of Object.keys(this.#browsers)) {
      await this.#browsers[key as BrowserKey].close();
    }
  }

  // Initializing Chrome

  async #launchBrowserChrome(key: BrowserKey): Promise<Browser> {
    const browser = await chromium.launchPersistentContext(
      path.join("profiles", key),
      {
        headless: true, // NOTE: it may not work in headful mode and the new implementation of headless mode
        locale: 'en-GB',
      }
    );
    return browser;
  }

  // Initializing Brave

  async #launchBrowserBrave(key: BrowserKey): Promise<Browser> {
    const browser = await chromium.launchPersistentContext(
      path.join("profiles", key),
      {
        headless: true, // NOTE: it may not work in headful mode and the new implementation of headless mode
        executablePath: env.bravePath,
        locale: 'en-GB',

      }
    );
    return browser;
  }

// Initializing Safari

  async #launchBrowserSafari(key: BrowserKey): Promise<Browser> {
    const browser = await webkit.launchPersistentContext(
      path.join("profiles", key),
      {
        headless: true, // NOTE: it may not work in headful mode and the new implementation of headless mode
        locale: 'en-GB',
      }
    );
    return browser;
  }

  // Initializing Safari

  async #launchBrowserFirefox(key: BrowserKey): Promise<Browser> {
    const browser = await firefox.launchPersistentContext(
      path.join("profiles", key),
      {
        headless: true, // NOTE: it may not work in headful mode and the new implementation of headless mode
        locale: 'en-GB',
      }
    );
    return browser;
  }


}

export default BrowserManager;
