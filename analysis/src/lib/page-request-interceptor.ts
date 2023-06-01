import { Page } from "puppeteer";
import AnalysisLogger from "./analysis-logger";

async function setupPageRequestInterceptor(
  page: Page,
  logger: AnalysisLogger
): Promise<void> {
  await page.setRequestInterception(true);

  page.on("request", (request) => {
    request.continue({
      headers: {
        ...request.headers(),
        "x-ytjs-resource-type": request.resourceType(),
      },
    });
  });

  page.on("response", (response) => {
    if (response.status() === 502) {
      logger.addError({ type: "instrumentation-failure", url: response.url() });
    }
  });

  page.on("console", (message) => {
    if (message.type() === "error") {
      const errorStack = message.text();
      if (errorStack.indexOf("\n    at YuantijsAnalysis.") !== -1) {
        logger.addError({
          type: "runtime-error",
          message: errorStack,
        });
      }
    }
  });
}

export { setupPageRequestInterceptor };
