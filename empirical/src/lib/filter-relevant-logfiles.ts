import { Logfile, isStorageLabel } from "@yuantijs/core";

function filterRelevantLogfiles(logfiles: Logfile[]): Logfile[] {
  return logfiles.map((logfile) => ({
    ...logfile,
    trackingResultRecord: Object.fromEntries(
      Object.entries(logfile.trackingResultRecord).map(
        ([url, trackingResult]) => [
          url,
          {
            ...trackingResult,
            flowCollection: trackingResult.flowCollection.filter((flow) => {
              return (
                (() => {
                  if (isStorageLabel(flow.sinkLabel)) {
                    return flow.taint.some((label) => !isStorageLabel(label));
                  } else {
                    return flow.taint.some((label) => isStorageLabel(label));
                  }
                })() &&
                (() => {
                  return flow.taint.every(
                    (label) =>
                      label.location.url.toString() ===
                      flow.sinkLabel.location.url.toString()
                  );
                })()
              );
            }),
          },
        ]
      )
    ),
  }));
}

export default filterRelevantLogfiles;
