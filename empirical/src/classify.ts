import * as fsPromises from "fs/promises";
import {
  Flow,
  Logfile,
  flowLabels,
  isStorageLabel,
  isStorageSinkLabel,
} from "@yuantijs/core";
import { getArgResults, readLogfiles } from "./lib/input";
import { readBlocklist } from "./lib/blocklist";
import {
  CachedTrackingDetector,
  BasicTrackingDetector,
  TrackingDetector,
} from "./lib/tracking-detector";
import filterRelevantLogfiles from "./lib/filter-relevant-logfiles";
import Classificator from "./lib/classificator";
import { BasicSiteParser, SiteParser } from "./lib/site-parser";

async function main() {
  const args = require("minimist")(process.argv.slice(2));

  const trackingDetector: TrackingDetector = new CachedTrackingDetector(
    BasicTrackingDetector.fromBlocklist([
      ...(await readBlocklist("./data/easylist.block.json")),
      ...(await readBlocklist("./data/easyprivacy.block.json")),
    ])
  );

  const siteParser: SiteParser = new BasicSiteParser();

  const classificator = new Classificator(trackingDetector, siteParser);

  const logfiles = await readLogfiles(getArgResults(args));
  console.log(`${logfiles.length} logfiles`);

  printStatsBeforeFilterRelevantLogfiles(logfiles);

  const relevantLogfiles: Logfile[] = filterRelevantLogfiles(logfiles);

  const classifiedLogfiles = relevantLogfiles.map((logfile, logfileIndex) => {
    console.log(logfileIndex + 1, logfile.site);
    return classificator.classifyLogfile(logfile);
  });

  await fsPromises.writeFile(
    "classified.json",
    JSON.stringify(classifiedLogfiles)
  );

  const falsePositivesAnalysisLogfiles = [...relevantLogfiles]
    .filter((logfile) =>
      Object.entries(logfile.trackingResultRecord).some(
        ([_, trackingResult]) => trackingResult.flowCollection.length > 0
      )
    )
    .map((logfile) => ({
      site: logfile.site,
      flowCollectionRecord: Object.fromEntries(
        Object.entries(logfile.trackingResultRecord).map(
          ([url, trackingResult]) => [url, trackingResult.flowCollection]
        )
      ),
    }))
    .slice(250);

  await fsPromises.writeFile(
    "fpAnalysis.json",
    JSON.stringify(falsePositivesAnalysisLogfiles, undefined, 2)
  );

  const wsSyncingValidation = classifiedLogfiles
    .map((classifiedLogfile) => ({
      site: classifiedLogfile.site,
      flowCollection: classifiedLogfile.flowCollection
        .filter((classifiedFlow) => classifiedFlow.wsSyncing)
        .map((classifiedFlow) =>
          classificator.getFlowByClassifiedFlow(classifiedFlow)
        )
        .filter((flow): flow is Flow => flow !== undefined),
    }))
    .filter((data) => data.flowCollection.length > 0);

  await fsPromises.writeFile(
    "wsSyncing.json",
    JSON.stringify(wsSyncingValidation, undefined, 2)
  );
}

main();

function printStatsBeforeFilterRelevantLogfiles(logfiles: Logfile[]): void {
  console.log(
    "no. flows with Storage-related labels",
    logfiles.flatMap((logfile) =>
      Object.entries(logfile.trackingResultRecord).flatMap(
        ([_, trackingResult]) =>
          trackingResult.flowCollection.filter((flow) =>
            flowLabels(flow).some((label) => isStorageLabel(label))
          )
      )
    ).length
  );
  console.log(
    "no. sites with flows with Storage-related labels",
    logfiles.filter((logfile) =>
      Object.entries(logfile.trackingResultRecord).some(([_, trackingResult]) =>
        trackingResult.flowCollection.some((flow) =>
          flowLabels(flow).some((label) => isStorageLabel(label))
        )
      )
    ).length
  );

  console.log(
    "no. calls to setItem",
    logfiles.flatMap((logfile) =>
      Object.entries(logfile.trackingResultRecord).flatMap(
        ([_, trackingResult]) =>
          trackingResult.storageLabelCollection.filter((label) =>
            isStorageSinkLabel(label)
          )
      )
    ).length
  );
  console.log(
    "no. sites with calls to setItem",
    logfiles.filter((logfile) =>
      Object.entries(logfile.trackingResultRecord).some(([_, trackingResult]) =>
        trackingResult.storageLabelCollection.some((label) =>
          isStorageSinkLabel(label)
        )
      )
    ).length
  );
}
