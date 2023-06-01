import AnalysisLogger from "./analysis-logger";
import BrowserManager from "./browser-manager";
import AnalysisRunner from "./analysis-runner";

async function startAnalysis(
  browserManager: BrowserManager,
  siteList: string[]
): Promise<void> {
  const analysisName = `${+new Date()}`;
  for (const site of siteList) {
    console.log("start analysis", site);
    const logger = new AnalysisLogger(analysisName, site);
    try {
      const runner = new AnalysisRunner(
        `http://${site}`,
        browserManager,
        logger
      );
      await runner.runAnalysis();
    } catch (e) {
      console.error(e);
    }
    await logger.persist();
    console.log("end analysis", site);
  }
}

export { startAnalysis };
