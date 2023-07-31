import * as mockttp from "mockttp";
import { startAnalysis } from "./lib/start-analysis";
import BrowserManager from "./lib/browser-manager";
import {
  getArgFile,
  getArgLength,
  getArgOffset,
  readSiteListFromTrancoListFile,
} from "./lib/input";

async function main() {
  const args = require("minimist")(process.argv.slice(2));

  const siteList = await readSiteListFromTrancoListFile(
    getArgFile(args),
    getArgOffset(args),
    getArgLength(args)
  );
  console.log(siteList);
  console.log(`${siteList.length} sites`);

  const certOptions = await mockttp.generateCACertificate();
  const caFingerprint = mockttp.generateSPKIFingerprint(certOptions.cert);

  const browserManager = new BrowserManager();
  await browserManager.launchAll();

  await startAnalysis(browserManager, siteList);

  await browserManager.closeAll();

  console.log("THE END");
}

process.setUncaughtExceptionCaptureCallback((err) => {
  console.error(err);
});

main();
