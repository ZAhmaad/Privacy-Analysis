import assert from "assert";
import path from "path";
// import puppeteer, { Browser } from "puppeteer";
import { chromium, BrowserContext as Browser } from "playwright";

// Define four browsers: CA and CT are for Chrome and BA and BT are brave
type BrowserStore = { CA: Browser; CT: Browser; BA: Browser; BT: Browser };

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
      CA: await this.#launchBrowserChrome("CA"),
      CT: await this.#launchBrowserChrome("CT"),
      BA: await this.#launchBrowserBrave("BA"),
      BT: await this.#launchBrowserBrave("BT"),
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
        executablePath:
          "C:\\Program Files\\BraveSoftware\\Brave-Browser\\Application\\brave.exe",
      }
    );
    return browser;
  }
}

export default BrowserManager;
