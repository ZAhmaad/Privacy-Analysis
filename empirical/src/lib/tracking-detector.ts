import RE2 from "re2";
import { Blocklist } from "./blocklist";

type ResourceType = "script" | "document";

interface TrackingDetector {
  isTrackingUrl(url: URL, origin: string, resourceType?: ResourceType): boolean;
}

export { TrackingDetector };

interface TrackingDetectorRule {
  actionType: "block" | "ignore-previous-rules";
  urlFilter: RegExp;
  scriptResourceType: boolean;
  documentResourceType: boolean;
  firstParty: boolean;
  thirdParty: boolean;
  ifDomain: string[] | null;
  unlessDomain: string[] | null;
}

class BasicTrackingDetector implements TrackingDetector {
  #rules: TrackingDetectorRule[];

  constructor(rules: TrackingDetectorRule[]) {
    this.#rules = rules;
  }

  isTrackingUrl(
    url: URL,
    origin: string,
    resourceType?: ResourceType
  ): boolean {
    const isFirstParty = url.origin === origin;
    return this.#rules.reduce((blocked, rule) => {
      if (blocked) {
        return !(
          rule.actionType === "ignore-previous-rules" &&
          this.#ruleMatches(rule, url, resourceType ?? "script", isFirstParty)
        );
      } else {
        return (
          rule.actionType === "block" &&
          this.#ruleMatches(rule, url, resourceType ?? "script", isFirstParty)
        );
      }
    }, false);
  }

  #ruleMatches(
    rule: TrackingDetectorRule,
    url: URL,
    resourceType: ResourceType,
    isFirstParty: boolean
  ): boolean {
    return (
      (resourceType === "script"
        ? rule.scriptResourceType
        : rule.documentResourceType) &&
      (isFirstParty ? rule.firstParty : rule.thirdParty) &&
      (rule.ifDomain
        ? rule.ifDomain.some((domain) => url.hostname.endsWith(domain))
        : true) &&
      (rule.unlessDomain
        ? !rule.unlessDomain.some((domain) => url.hostname.endsWith(domain))
        : true) &&
      rule.urlFilter.test(url.href)
    );
  }

  static fromBlocklist(blocklist: Blocklist): BasicTrackingDetector {
    const rules: TrackingDetectorRule[] = blocklist
      .filter(
        (rule) =>
          rule.action.type === "block" ||
          rule.action.type === "ignore-previous-rules"
      )
      .filter(
        (rule) =>
          !rule.trigger["resource-type"] ||
          rule.trigger["resource-type"].includes("script") ||
          rule.trigger["resource-type"].includes("document")
      )
      .map((rule) => {
        return {
          actionType: rule.action.type as TrackingDetectorRule["actionType"],
          urlFilter: new RE2(
            rule.trigger["url-filter"],
            rule.trigger["url-filter-is-case-sensitive"] ? "" : "i"
          ),
          scriptResourceType:
            !rule.trigger["resource-type"] ||
            rule.trigger["resource-type"].includes("script"),
          documentResourceType:
            !rule.trigger["resource-type"] ||
            rule.trigger["resource-type"].includes("document"),
          firstParty: rule.trigger["load-type"]
            ? rule.trigger["load-type"].includes("first-party")
            : true,
          thirdParty: rule.trigger["load-type"]
            ? rule.trigger["load-type"].includes("third-party")
            : true,
          ifDomain: rule.trigger["if-domain"]
            ? rule.trigger["if-domain"].map(
                (domain) => "." + domain.substring(1)
              )
            : null,
          unlessDomain: rule.trigger["unless-domain"]
            ? rule.trigger["unless-domain"].map(
                (domain) => "." + domain.substring(1)
              )
            : null,
        };
      });
    return new BasicTrackingDetector(rules);
  }
}

export { TrackingDetectorRule, BasicTrackingDetector };

class CachedTrackingDetector implements TrackingDetector {
  #trackingDetector: TrackingDetector;
  #cache: Map<string, Map<string, boolean>>;

  constructor(trackingDetector: TrackingDetector) {
    this.#trackingDetector = trackingDetector;
    this.#cache = new Map();
  }

  isTrackingUrl(
    url: URL,
    origin: string,
    resourceType?: ResourceType
  ): boolean {
    const originMap = this.#getOriginMap(origin);
    const cached = originMap.get(url.href);
    if (cached !== undefined) {
      return cached;
    } else {
      const result = this.#trackingDetector.isTrackingUrl(
        url,
        origin,
        resourceType
      );
      originMap.set(url.href, result);
      return result;
    }
  }

  #getOriginMap(origin: string): Map<string, boolean> {
    let originMap = this.#cache.get(origin);
    if (!originMap) {
      originMap = new Map();
      this.#cache.set(origin, originMap);
    }
    return originMap;
  }
}

export { CachedTrackingDetector };
