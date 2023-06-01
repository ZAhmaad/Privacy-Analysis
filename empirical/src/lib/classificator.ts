import {
  Flow,
  Logfile,
  NetworkLabel,
  flowLabels,
  isNetworkLabel,
  isStorageLabel,
  isStorageSourceLabel,
} from "@yuantijs/core";
import { getCspTrackingKeyCollectionRecord } from "./csp-tracking";
import { TrackingDetector } from "./tracking-detector";
import { SiteParser } from "./site-parser";
import { getCategoryBitmapByFlow } from "./category-bitmap";
import { getAnalysisErrorBitmapByLogfile } from "./analysis-error-bitmap";

interface ClassifiedFlow {
  confidentiality: boolean;
  integrity: boolean;
  local: boolean;
  session: boolean;
  external: false | "same-site" | "x-site";
  tracking: boolean;
  cspTracking: boolean;
  categoryBits: number;
  wsSyncing: boolean;
}

interface ClassifiedScript {
  url: string;
  tracking: boolean;
  cspTracking: boolean;
  flowsCount: number;
}

interface ClassifiedLogfile {
  site: string;
  flowCollection: ClassifiedFlow[];
  scriptCollection: ClassifiedScript[];
  xsTracking: boolean;
  iframeLocalStorageIsUsed: boolean;
  xsTrackingOrigins: string[];
  xsTrackingOriginsInFilterList: string[];
  localStorageSnapshotKeyCount: number;
  localStorageSetItemKeyCount: number;
  errorBits: number;
}

export { ClassifiedFlow, ClassifiedScript, ClassifiedLogfile };

class Classificator {
  #trackingDetector: TrackingDetector;
  #siteParser: SiteParser;
  #classifiedFlowToFlowMap: WeakMap<ClassifiedFlow, Flow>;

  constructor(trackingDetector: TrackingDetector, siteParser: SiteParser) {
    this.#trackingDetector = trackingDetector;
    this.#siteParser = siteParser;
    this.#classifiedFlowToFlowMap = new WeakMap();
  }

  getFlowByClassifiedFlow(flow: ClassifiedFlow): Flow | undefined {
    return this.#classifiedFlowToFlowMap.get(flow);
  }

  classifyLogfile(logfile: Logfile): ClassifiedLogfile {
    const cspTrackingKeyCollectionRecord =
      getCspTrackingKeyCollectionRecord(logfile);

    const iframeLocalStorageIsUsed = Object.entries(
      logfile.storageSnapshotRecordA
    )
      .slice(1)
      .some(([_, storageSnapshot]) => {
        return Object.entries(storageSnapshot.localStorage).length > 0;
      });
    const xsTrackingLogfiles = Object.entries(logfile.storageSnapshotRecordA)
      .slice(1)
      .filter(([origin, storageSnapshot]) => {
        const cspTrackingKeyCollection = cspTrackingKeyCollectionRecord[origin];
        return (
          cspTrackingKeyCollection &&
          Object.entries(storageSnapshot.localStorage).some(([key, _]) =>
            cspTrackingKeyCollection.includes(key)
          )
        );
      });
    const xsTracking = xsTrackingLogfiles.length > 0;
    const xsTrackingOrigins = xsTrackingLogfiles.map(([origin, _]) => origin);
    const xsTrackingOriginsInFilterList = xsTrackingLogfiles
      .filter(([origin, _]) =>
        this.#trackingDetector.isTrackingUrl(new URL(origin), "", "document")
      )
      .map(([origin, _]) => origin);

    const [localStorageSnapshotKeyCount, localStorageSetItemKeyCount] =
      Object.entries(logfile.storageSnapshotRecordA)
        .map(([origin, storageSnapshot]): [number, number] => {
          const localStorageSnapshotKeys = Object.keys(
            storageSnapshot.localStorage
          );
          const localStorageSnapshotKeyCount = localStorageSnapshotKeys.length;
          const localStorageSetItemKeySet = new Set(
            Object.entries(logfile.trackingResultRecord)
              .filter(([rawUrl, _]) => new URL(rawUrl).origin === origin)
              .flatMap(([_, trackingResult]) =>
                trackingResult.storageLabelCollection
                  .filter((label) => label.type === "localStorage.setItem")
                  .map((label) => label.info.key)
              )
          );
          const localStorageSetItemKeyCount = localStorageSnapshotKeys.filter(
            (key) => localStorageSetItemKeySet.has(key)
          ).length;
          return [localStorageSnapshotKeyCount, localStorageSetItemKeyCount];
        })
        .reduce(
          ([a0, a1], [b0, b1]): [number, number] => [a0 + b0, a1 + b1],
          [0, 0]
        );
    const errorBits = getAnalysisErrorBitmapByLogfile(logfile);

    return {
      site: logfile.site,
      flowCollection: this.#classifyFlowCollection(
        logfile,
        cspTrackingKeyCollectionRecord
      ),
      scriptCollection: this.#classifyScriptCollection(
        logfile,
        cspTrackingKeyCollectionRecord
      ),
      xsTracking: xsTracking,
      iframeLocalStorageIsUsed,
      xsTrackingOrigins,
      xsTrackingOriginsInFilterList,
      localStorageSnapshotKeyCount,
      localStorageSetItemKeyCount,
      errorBits,
    };
  }

  #classifyFlowCollection(
    logfile: Logfile,
    cspTrackingKeyCollectionRecord: Record<string, string[] | undefined>
  ): ClassifiedFlow[] {
    return Object.entries(logfile.trackingResultRecord).flatMap(
      ([rawUrl, trackingResult]) => {
        const url = new URL(rawUrl);
        const origin = url.origin;
        const site = this.#siteParser.getSiteByUrl(url);
        const cspTrackingKeyCollection = cspTrackingKeyCollectionRecord[origin];
        return trackingResult.flowCollection.map((flow) => {
          const classifiedFlow = this.#classifyFlow(
            flow,
            origin,
            site,
            cspTrackingKeyCollection
          );
          this.#classifiedFlowToFlowMap.set(classifiedFlow, flow);
          return classifiedFlow;
        });
      }
    );
  }

  #classifyFlow(
    flow: Flow,
    origin: string,
    site: string,
    cspTrackingKeyCollection: string[] | undefined
  ): ClassifiedFlow {
    const labels = flowLabels(flow);

    const confidentiality =
      !isStorageLabel(flow.sinkLabel) &&
      flow.taint.some((label) => isStorageLabel(label));
    const integrity = isStorageLabel(flow.sinkLabel);
    const local = labels.some(
      (label) => isStorageLabel(label) && label.type.startsWith("localStorage")
    );
    const session = labels.some(
      (label) =>
        isStorageLabel(label) && label.type.startsWith("sessionStorage")
    );
    const external = (() => {
      if (
        labels.some(
          (label) => isNetworkLabel(label) && label.info.url.origin !== origin
        )
      )
        return labels
          .filter(
            (label): label is NetworkLabel =>
              isNetworkLabel(label) && label.info.url.origin !== origin
          )
          .every(
            (label) => this.#siteParser.getSiteByUrl(label.info.url) === site
          )
          ? "same-site"
          : "x-site";
      else {
        return false;
      }
    })();
    const tracking = labels.some((label) =>
      this.#trackingDetector.isTrackingUrl(label.location.url, origin)
    );
    const cspTracking = labels.some((label) => {
      return (
        isStorageLabel(label) &&
        cspTrackingKeyCollection?.includes(label.info.key)
      );
    });
    const categoryBits = getCategoryBitmapByFlow(flow);
    const wsSyncing = (() => {
      const sinkLabel = flow.sinkLabel;
      if (tracking && cspTracking && isNetworkLabel(sinkLabel)) {
        return flow.taint.some(
          (label) =>
            isStorageSourceLabel(label) &&
            label.type === "localStorage.getItem" &&
            label.info.ownership !== null &&
            this.#siteParser.getSiteByUrl(sinkLabel.info.url) !==
              this.#siteParser.getSiteByUrl(label.info.ownership)
        );
      } else {
        return false;
      }
    })();

    return {
      confidentiality,
      integrity,
      local,
      session,
      external,
      tracking,
      cspTracking,
      categoryBits,
      wsSyncing,
    };
  }

  #classifyScriptCollection(
    logfile: Logfile,
    cspTrackingKeyCollectionRecord: Record<string, string[] | undefined>
  ): ClassifiedScript[] {
    return Object.entries(logfile.trackingResultRecord).flatMap(
      ([rawUrl, trackingResult]) => {
        const url = new URL(rawUrl);
        const origin = url.origin;
        const cspTrackingKeyCollection = cspTrackingKeyCollectionRecord[origin];
        const scriptUrls = [
          ...new Map(
            trackingResult.flowCollection
              .flatMap((flow) =>
                flowLabels(flow).map((label) => label.location.url)
              )
              .map((scriptUrl) => [scriptUrl.toString(), scriptUrl])
          ).values(),
        ];
        const rawCspTrackingScriptUrlSet = new Set(
          trackingResult.flowCollection.flatMap((flow) =>
            flowLabels(flow)
              .filter(
                (label) =>
                  isStorageLabel(label) &&
                  cspTrackingKeyCollection?.includes(label.info.key)
              )
              .map((label) => label.location.url.toString())
          )
        );
        return scriptUrls.map((scriptUrl) => {
          const rawScriptUrl = scriptUrl.toString();
          return {
            url: rawScriptUrl,
            tracking: this.#trackingDetector.isTrackingUrl(scriptUrl, origin),
            cspTracking: rawCspTrackingScriptUrlSet.has(rawScriptUrl),
            flowsCount: trackingResult.flowCollection.filter((flow) =>
              flowLabels(flow).some(
                (label) => label.location.url.toString() === rawScriptUrl
              )
            ).length,
          };
        });
      }
    );
  }
}

export default Classificator;
