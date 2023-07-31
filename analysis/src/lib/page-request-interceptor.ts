import { APIResponse, Page, Request } from "playwright";
import { AnalysisError } from "@yuantijs/core";
import {
  InstrumentOptions,
  instrumentHtml,
  instrumentJavaScript,
} from "./instrument";

async function modifyResponseBody(
  request: Request,
  response: APIResponse,
  body: string
): Promise<string> {
  const resourceType = request.resourceType();
  if (resourceType === "document" || resourceType === "script") {
    const contentType = (() => {
      const raw = response.headers()["content-type"];
      if (!raw) return;
      const endOfMimeType = raw.indexOf(";");
      const mimeType =
        endOfMimeType < 0 ? raw : raw.substring(0, endOfMimeType);
      switch (mimeType) {
        case "text/html":
          return "html";
        case "text/javascript":
        case "application/javascript":
        case "application/x-javascript":
          return "js";
        default:
          if (mimeType) return "other";
      }
    })();

    return await (async () => {
      const instrumentWith = async (
        instrumentFn: (code: string, opts: InstrumentOptions) => Promise<string>
      ): Promise<string> => {
        return await instrumentFn(body, {
          url: request.url(),
          target: (() => {
            switch (resourceType) {
              case "document":
                return "html";
              case "script":
                return "js";
            }
          })(),
        });
      };

      if (
        resourceType === "document" &&
        (!contentType || contentType === "html")
      ) {
        return await instrumentWith(instrumentHtml);
      } else if (
        resourceType === "script" &&
        (!contentType || contentType === "js")
      ) {
        return await instrumentWith(instrumentJavaScript);
      } else {
        return body;
      }
    })();
  } else {
    return body;
  }
}

async function setupPageRequestInterceptor(
  page: Page,
  onError: (error: AnalysisError) => void
): Promise<void> {
  await page.route("**", async (route) => {
    const response = await route.fetch();
    try {
      route.fulfill({
        response,
        body: await modifyResponseBody(
          route.request(),
          response,
          (await response.body()).toString()
        ),
      });
    } catch {
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
