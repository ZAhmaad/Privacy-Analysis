import * as mockttp from "mockttp";
import startProxyServer from "./lib/proxy-server";
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
  const server = await startProxyServer(certOptions);

  const browserManager = new BrowserManager({
    proxyPort: server.port,
    proxyCaFingerprint: caFingerprint,
  });
  await browserManager.launchAll();

  await startAnalysis(browserManager, siteList);

  await browserManager.closeAll();

  await server.stop();

  console.log("THE END");
}

process.setUncaughtExceptionCaptureCallback((err) => {
  console.error(err);
});

main();
