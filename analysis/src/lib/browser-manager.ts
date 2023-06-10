import assert from "assert";
import path from "path";
import puppeteer, { Browser } from "puppeteer";

// Define four browsers: CA and CT are for Chrome and BA and BT are brave
type BrowserStore = { CA: Browser; CT: Browser; BA: Browser; BT: Browser };
type BrowserKey = keyof BrowserStore;

export { BrowserKey };

class BrowserManager {
  #proxyPort: number;
  #proxyCaFingerprint: string;

  #browsers: BrowserStore | null;

  constructor(options: BrowserManagerOptions) {
    this.#proxyPort = options.proxyPort;
    this.#proxyCaFingerprint = options.proxyCaFingerprint;

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
      CA: await this.#launchBrowserChrome("CA", false),
      CT: await this.#launchBrowserChrome("CT", true),
      BA: await this.#launchBrowserBrave("BA", false),
      BT: await this.#launchBrowserBrave("BT", true),
    };
  }

  async closeAll() {
    if (!this.#browsers) return;
    for (const key of Object.keys(this.#browsers)) {
      await this.#browsers[key as BrowserKey].close();
    }
  }

  // Initializing Chrome

  async #launchBrowserChrome(
    key: BrowserKey,
    proxyEnabled: boolean
  ): Promise<Browser> {
    const browser = await puppeteer.launch({
      ...(proxyEnabled
        ? {
            args: [
              `--proxy-server=127.0.0.1:${this.#proxyPort}`,
              `--ignore-certificate-errors-spki-list=${
                this.#proxyCaFingerprint
              }`,
            ],
          }
        : {}),
      defaultViewport: null,
      headless: true, // NOTE: it may not work in headful mode and the new implementation of headless mode
      pipe: true,
      userDataDir: path.join("profiles", key),
    });
    return browser;
  }

  // Initializing Brave

  async #launchBrowserBrave(
    key: BrowserKey,
    proxyEnabled: boolean
  ): Promise<Browser> {
    const browser = await puppeteer.launch({
      ...(proxyEnabled
        ? {
            args: [
              `--proxy-server=127.0.0.1:${this.#proxyPort}`,
              `--ignore-certificate-errors-spki-list=${
                this.#proxyCaFingerprint
              }`,
            ],
          }
        : {}),
      defaultViewport: null,
      headless: true, // NOTE: it may not work in headful mode and the new implementation of headless mode
      executablePath:
        "C:\\Program Files\\BraveSoftware\\Brave-Browser\\Application\\brave.exe",
      pipe: true,
      userDataDir: path.join("profiles", key),
    });
    return browser;
  }
}

export default BrowserManager;

interface BrowserManagerOptions {
  proxyPort: number;
  proxyCaFingerprint: string;
}

export { BrowserManagerOptions };
