import { Page } from "playwright";
import { AnalysisError } from "@yuantijs/core";

async function setupPageRequestInterceptor(
  page: Page,
  onError: (error: AnalysisError) => void
): Promise<void> {
  // await page.setRequestInterception(true);
  await page.route('**', (route: any) => {
    route.continue().catch(() => {});
  });
  

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
