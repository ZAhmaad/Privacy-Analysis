import * as psl from "psl";

interface SiteParser {
  getSiteByUrl(url: URL): string;
}

export { SiteParser };

class BasicSiteParser implements SiteParser {
  getSiteByUrl(url: URL): string {
    const result = psl.parse(url.hostname);
    if (!result.error) {
      if (result.domain) {
        return result.domain;
      } else if (result.tld) {
        return result.tld;
      } else {
        throw new Error(
          `Expected parsed domain to be string, but got null (input: ${url})`
        );
      }
    } else {
      throw new Error(`${result.error.message} (input: ${url})`);
    }
  }
}

export { BasicSiteParser };
