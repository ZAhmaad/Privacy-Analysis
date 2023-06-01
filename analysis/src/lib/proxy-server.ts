import * as mockttp from "mockttp";
import {
  InstrumentOptions,
  instrumentHtml,
  instrumentJavaScript,
} from "./instrument";

export interface InterceptedRequest {
  id: string;
  url: string;
  resourceType: "document" | "script";
}

function setupProxyServer(server: mockttp.Mockttp): void {
  const iceptRequests = new Map<string, InterceptedRequest>();

  server.forAnyRequest().thenPassThrough({
    async beforeRequest(request) {
      const resourceType = (() => {
        const raw = request.headers["x-ytjs-resource-type"];
        switch (raw) {
          case "document":
          case "script":
            return raw;
        }
      })();
      if (resourceType) {
        iceptRequests.set(request.id, {
          id: request.id,
          url: request.url,
          resourceType,
        });
      }
    },

    async beforeResponse(response) {
      const iceptRequest = iceptRequests.get(response.id);
      if (!iceptRequest) return;
      const contentType = (() => {
        const raw = response.headers["content-type"];
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
      try {
        const instrumented = await (() => {
          const instrumentWith = async (
            instrumentFn: (
              code: string,
              opts: InstrumentOptions
            ) => Promise<string>
          ): Promise<string | undefined> => {
            const original = await response.body.getText();
            if (original) {
              const opts: InstrumentOptions = {
                url: iceptRequest.url,
                target: (() => {
                  switch (iceptRequest.resourceType) {
                    case "document":
                      return "html";
                    case "script":
                      return "js";
                  }
                })(),
              };
              return await instrumentFn(original, opts);
            }
          };
          const resourceType = iceptRequest.resourceType;
          if (
            resourceType === "document" &&
            (!contentType || contentType === "html")
          ) {
            return instrumentWith(instrumentHtml);
          } else if (
            resourceType === "script" &&
            (!contentType || contentType === "js")
          ) {
            return instrumentWith(instrumentJavaScript);
          }
        })();
        if (instrumented) {
          return {
            statusCode: response.statusCode,
            headers: {
              ...response.headers,
              "content-length": undefined,
              "content-security-policy": undefined, // Disable the Content Security Policy (CSP)
              "content-security-policy-report-only": undefined, // Disable the Content Security Policy (CSP)
            },
            body: instrumented,
          };
        }
      } catch (e) {
        return {
          statusCode: 502,
          statusMessage: "Bad Gateway",
        };
      }
    },
  });
}

async function startProxyServer(
  https: mockttp.CertDataOptions
): Promise<mockttp.Mockttp> {
  const server = mockttp.getLocal({ https });

  setupProxyServer(server);
  await server.start();

  console.log(`Server running on port ${server.port}`);

  return server;
}

export default startProxyServer;
