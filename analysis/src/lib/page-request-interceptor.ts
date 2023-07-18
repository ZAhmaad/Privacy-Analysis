import { Page } from "puppeteer";
import { AnalysisError } from "@yuantijs/core";

async function setupPageRequestInterceptor(
  page: Page,
  onError: (error: AnalysisError) => void
): Promise<void> {
  await page.setRequestInterception(true);

  page.on("request", (request) => {
    if (request.isInterceptResolutionHandled()) return;

    request.continue(
      {
        headers: {
          ...request.headers(),
          "x-ytjs-resource-type": request.resourceType(),
        },
      },
      1
    );
  });

  page.on("response", (response) => {
    if (response.status() === 502) {
      onError({ type: "instrumentation-failure", url: response.url() });
    }
  });

  page.on("console", (message) => {
    if (message.type() === "error") {
      const errorStack = message.text();
      if (errorStack.indexOf("\n    at YuantijsAnalysis.") !== -1) {
        onError({
          type: "runtime-error",
          message: errorStack,
        });
      }
    }
  });
}

export { setupPageRequestInterceptor };
