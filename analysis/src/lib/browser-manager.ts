import assert from "assert";
import path from "path";
import puppeteer, { Browser } from "puppeteer";

// Define four browsers: CA and CT are for Chrome and BA and BT are brave
type BrowserStore = { CA: Browser;  CT: Browser; BA: Browser;  BT: Browser };
type BrowserKey = keyof BrowserStore;

class BrowserManager {
  #proxyPort: number;
  #proxyCaFingerprint: string;
  #headless: boolean;

  #browsers: BrowserStore | null;

  constructor(options: BrowserManagerOptions) {
    this.#proxyPort = options.proxyPort;
    this.#proxyCaFingerprint = options.proxyCaFingerprint;
    this.#headless =
      typeof options.headless !== "undefined" ? options.headless : false;

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

// Initializting Chrome

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
      headless: false, 
      pipe: true,
      userDataDir: path.join("chromeprofiles", key),
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
      headless: false, 
      executablePath: '/Applications/Brave Browser 3.app/Contents/MacOS/Brave Browser',
      pipe: true,
      userDataDir: path.join("braveprofiles", key),
    });
    return browser;
  }

  
}

export default BrowserManager;

interface BrowserManagerOptions {
  proxyPort: number;
  proxyCaFingerprint: string;
  headless?: boolean;
}

export { BrowserManagerOptions };
