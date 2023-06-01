import {
  ClassifiedFlowPredicate,
  ClassifiedLogfilePredicate,
  ClassifiedScriptPredicate,
  countFlows,
  countLogfiles,
  countLogfilesWhereSomeFlow,
  countLogfilesWhereSomeScript,
  countScripts,
} from "./counters";
import { ClassifiedFlow, ClassifiedLogfile } from "./classificator";
import CategoryFlags from "./category-bitmap";
import AnalysisErrorFlags from "./analysis-error-bitmap";

function checkBitmap(givenBits: number, expectedBits: number): boolean {
  return (givenBits & expectedBits) === expectedBits;
}

function renderStats(logfiles: ClassifiedLogfile[]): string {
  const errorsHtml = renderErrors(logfiles);

  return (
    "<div>" +
    `<p>no. total sites: ${logfiles.length}</p>` +
    `<p>no. sites where there is at least a (relevant) flow: ${countLogfiles(
      logfiles,
      (logfile) => logfile.flowCollection.length > 0
    )}</p>` +
    `<p>no. total (relevant) flows: ${countFlows(logfiles, () => true)}</p>` +
    `<p><i>${Math.round(
      (logfiles
        .map((logfile) => logfile.localStorageSetItemKeyCount)
        .reduce((acc, cur) => acc + cur, 0) *
        100) /
        logfiles
          .map((logfile) => logfile.localStorageSnapshotKeyCount)
          .reduce((acc, cur) => acc + cur, 0)
    )}% is the likelihood of items in localStorage to have a corresponding localStorage.setItem label</i> (flowCollection is complete)</p>` +
    errorsHtml +
    "</div>"
  );
}

function renderErrors(logfiles: ClassifiedLogfile[]): string {
  type ErrorAxisItem = {
    label: string;
    checkBits: (givenBits: number) => boolean;
  };
  const errorAxis: ErrorAxisItem[] = [
    {
      label: "loading-timeout",
      checkBits: (givenBits) =>
        checkBitmap(givenBits, AnalysisErrorFlags.LOADING_TIMEOUT),
    },
    {
      label: "navigation-error",
      checkBits: (givenBits) =>
        checkBitmap(givenBits, AnalysisErrorFlags.NAVIGATION_ERROR),
    },
    {
      label: "instrumentation-failure",
      checkBits: (givenBits) =>
        checkBitmap(givenBits, AnalysisErrorFlags.INSTRUMENTATION_FAILURE),
    },
    {
      label: "runtime-error",
      checkBits: (givenBits) =>
        checkBitmap(givenBits, AnalysisErrorFlags.RUNTIME_ERROR),
    },
    {
      label: "evaluation-timeout",
      checkBits: (givenBits) =>
        checkBitmap(givenBits, AnalysisErrorFlags.EVALUATION_TIMEOUT),
    },
    {
      label: "evaluation-error",
      checkBits: (givenBits) =>
        checkBitmap(givenBits, AnalysisErrorFlags.EVALUATION_ERROR),
    },
    {
      label: "assertion-error",
      checkBits: (givenBits) =>
        checkBitmap(givenBits, AnalysisErrorFlags.ASSERTION_ERROR),
    },
    { label: "ANY", checkBits: (givenBits) => givenBits !== 0 },
    { label: "NOTHING", checkBits: (givenBits) => givenBits === 0 },
  ];

  const incompleteFlowCollectionPredicate: ClassifiedLogfilePredicate = (
    logfile
  ) =>
    logfile.localStorageSetItemKeyCount < logfile.localStorageSnapshotKeyCount;
  const incompleteFlowCollectionSitesCount = logfiles.filter(
    incompleteFlowCollectionPredicate
  ).length;

  return errorAxis
    .map((item) => {
      const errorOccursPredicate: ClassifiedLogfilePredicate = (logfile) =>
        item.checkBits(logfile.errorBits);
      const errorOccursCount = logfiles.filter((logfile) =>
        errorOccursPredicate(logfile)
      ).length;
      const intersectionCount = logfiles.filter(
        (logfile) =>
          incompleteFlowCollectionPredicate(logfile) &&
          errorOccursPredicate(logfile)
      ).length;

      return (
        "<p>" +
        `P(${
          item.label
        } error occurs | flowCollection is incomplete)=${Math.round(
          (intersectionCount * 100) / incompleteFlowCollectionSitesCount
        )}%` +
        ", " +
        `P(flowCollection is incomplete | ${
          item.label
        } error occurs)=${Math.round(
          (intersectionCount * 100) / errorOccursCount
        )}%` +
        "</p>"
      );
    })
    .join("");
}

function renderTable2(logfiles: ClassifiedLogfile[]): string {
  interface XAxisItem {
    label: string;
    predicate: ClassifiedFlowPredicate;
  }
  const xAxis: XAxisItem[] = [
    {
      label: "Confid",
      predicate: (flow) => flow.confidentiality,
    },
    {
      label: "Integr",
      predicate: (flow) => flow.integrity,
    },
  ];

  interface YAxisItem {
    label: string;
    predicate: (flow: ClassifiedFlow, xAxisItem: XAxisItem) => boolean;
  }
  const yAxis: YAxisItem[] = [
    {
      label: "Cookies",
      predicate: (flow, xAxisItem) =>
        checkBitmap(
          flow.categoryBits,
          xAxisItem === xAxis[0]
            ? CategoryFlags.SINK_COOKIE
            : CategoryFlags.SOURCE_COOKIE
        ),
    },
    {
      label: "CurrentUrl",
      predicate: (flow, xAxisItem) =>
        xAxisItem === xAxis[0]
          ? false
          : checkBitmap(flow.categoryBits, CategoryFlags.SOURCE_CURRENT_URL),
    },
    {
      label: "Navigator",
      predicate: (flow, xAxisItem) =>
        xAxisItem === xAxis[0]
          ? false
          : checkBitmap(flow.categoryBits, CategoryFlags.SOURCE_NAVIGATOR),
    },
    {
      label: "Network",
      predicate: (flow, xAxisItem) =>
        checkBitmap(
          flow.categoryBits,
          xAxisItem === xAxis[0]
            ? CategoryFlags.SINK_NETWORK
            : CategoryFlags.SOURCE_NETWORK
        ),
    },
  ];

  const table = new Array<string[]>(yAxis.length);
  for (let row = 0; row < yAxis.length; ++row) {
    const tableRow = new Array<string>(xAxis.length);
    for (let col = 0; col < xAxis.length; ++col) {
      const predicate: ClassifiedFlowPredicate = (flow) =>
        xAxis[col].predicate(flow) && yAxis[row].predicate(flow, xAxis[col]);
      const flowsCount = countFlows(logfiles, predicate);
      const sitesCount = countLogfilesWhereSomeFlow(logfiles, predicate);
      tableRow[col] = `${flowsCount} / ${sitesCount}`;
    }
    table[row] = tableRow;
  }

  return (
    "<table>" +
    "<tr>" +
    "<th></th>" +
    xAxis.map((item) => `<th>${item.label}</th>`).join("") +
    "</tr>" +
    table
      .map(
        (tableRow, row) =>
          "<tr>" +
          `<th>${yAxis[row].label}</th>` +
          tableRow.map((tableData) => `<td>${tableData}</td>`).join("") +
          "</tr>"
      )
      .join("") +
    "</table>"
  );
}

function renderTable3(logfiles: ClassifiedLogfile[]): string {
  interface XAxisItem {
    groupId: number;
    label: string;
    predicate: ClassifiedFlowPredicate;
  }
  const xAxis: XAxisItem[] = [
    { groupId: 1, label: "Confid", predicate: (flow) => flow.confidentiality },
    { groupId: 1, label: "Integr", predicate: (flow) => flow.integrity },
    { groupId: 2, label: "Int", predicate: (flow) => flow.external === false },
    { groupId: 2, label: "Ext", predicate: (flow) => flow.external !== false },
    { groupId: 3, label: "Trk", predicate: (flow) => flow.tracking },
    { groupId: 3, label: "NonTrk", predicate: (flow) => !flow.tracking },
    {
      groupId: 5,
      label: "Local",
      predicate: (flow) => flow.local && !flow.session,
    },
    {
      groupId: 5,
      label: "Session",
      predicate: (flow) => !flow.local && flow.session,
    },
    {
      groupId: 5,
      label: "Both",
      predicate: (flow) => flow.local && flow.session,
    },
  ];

  const table = new Array<string[]>(xAxis.length);
  for (let row = 0; row < xAxis.length; ++row) {
    const tableRow = new Array<string>(xAxis.length);
    const totalCount = countFlows(logfiles, xAxis[row].predicate);
    for (let col = 0; col < xAxis.length; ++col) {
      if (xAxis[row].groupId !== xAxis[col].groupId) {
        const localCount = countFlows(
          logfiles,
          (flow) => xAxis[row].predicate(flow) && xAxis[col].predicate(flow)
        );
        const percentage = Math.round((localCount * 100) / totalCount);
        tableRow[col] = `${localCount} (${percentage}%)`;
      } else {
        tableRow[col] = "";
      }
    }
    table[row] = tableRow;
  }

  return (
    "<table>" +
    "<tr>" +
    "<th></th>" +
    xAxis.map((item) => `<th>${item.label}</th>`).join("") +
    "</tr>" +
    table
      .map(
        (tableRow, row) =>
          "<tr>" +
          `<th>${xAxis[row].label}</th>` +
          tableRow.map((tableData) => `<td>${tableData}</td>`).join("") +
          "</tr>"
      )
      .join("") +
    "</table>"
  );
}

function renderTable4(logfiles: ClassifiedLogfile[]): string {
  interface XAxisItem {
    label: string;
    predicate: ClassifiedFlowPredicate;
  }
  const xAxis: XAxisItem[] = [
    { label: "SameSite", predicate: (flow) => flow.external === "same-site" },
    { label: "CrossSite", predicate: (flow) => flow.external === "x-site" },
  ];

  interface YAxisItem {
    label: string;
    predicate: ClassifiedFlowPredicate;
  }
  const yAxis: YAxisItem[] = [
    { label: "Confid", predicate: (flow) => flow.confidentiality },
    { label: "Integr", predicate: (flow) => flow.integrity },
    { label: "Trk", predicate: (flow) => flow.tracking },
    { label: "NonTrk", predicate: (flow) => !flow.tracking },
    { label: "Local", predicate: (flow) => flow.local && !flow.session },
    { label: "Session", predicate: (flow) => !flow.local && flow.session },
    { label: "Both", predicate: (flow) => flow.local && flow.session },
  ];

  const table = new Array<string[]>(yAxis.length);
  for (let row = 0; row < yAxis.length; ++row) {
    const tableRow = new Array<string>(xAxis.length);
    const totalCount = countFlows(
      logfiles,
      (flow) => flow.external !== false && yAxis[row].predicate(flow)
    );
    for (let col = 0; col < xAxis.length; ++col) {
      const localCount = countFlows(
        logfiles,
        (flow) =>
          flow.external !== false &&
          xAxis[col].predicate(flow) &&
          yAxis[row].predicate(flow)
      );
      const percentage = Math.round((localCount * 100) / totalCount);
      tableRow[col] = `${localCount} (${percentage}%)`;
    }
    table[row] = tableRow;
  }

  return (
    "<table>" +
    "<tr>" +
    "<th></th>" +
    xAxis.map((item) => `<th>${item.label}</th>`).join("") +
    "</tr>" +
    table
      .map(
        (tableRow, row) =>
          "<tr>" +
          `<th>${yAxis[row].label}</th>` +
          tableRow.map((tableData) => `<td>${tableData}</td>`).join("") +
          "</tr>"
      )
      .join("") +
    "</table>"
  );
}

function renderScriptUseRankingList(logfiles: ClassifiedLogfile[]): string {
  interface ScriptPopularity {
    url: string;
    flowsCount: number;
    sitesCount: number;
    tracking: boolean;
    cspTracking: boolean;
  }
  const scriptPopularityMap = new Map<string, ScriptPopularity>();
  const getOrCreateScriptPopularity = (url: string): ScriptPopularity => {
    const existing = scriptPopularityMap.get(url);
    if (existing) {
      return existing;
    } else {
      const fresh = {
        url,
        flowsCount: 0,
        sitesCount: 0,
        tracking: false,
        cspTracking: false,
      };
      scriptPopularityMap.set(url, fresh);
      return fresh;
    }
  };
  for (const logfile of logfiles) {
    const scriptUrlSet = new Set<string>();
    for (const script of logfile.scriptCollection) {
      const scriptUrl = script.url;
      const scriptPopularity = getOrCreateScriptPopularity(scriptUrl);
      scriptPopularity.flowsCount += script.flowsCount;
      scriptPopularity.tracking ||= script.tracking;
      scriptPopularity.cspTracking ||= script.cspTracking;
      if (!scriptUrlSet.has(scriptUrl)) {
        scriptPopularity.sitesCount += 1;
        scriptUrlSet.add(scriptUrl);
      }
    }
  }

  const scriptUseRankingList = [...scriptPopularityMap.values()].sort(
    (a, b) => b.sitesCount - a.sitesCount
  );

  const mostUsedScriptsLimit = 10;
  const mostUsedScripts = scriptUseRankingList.slice(0, mostUsedScriptsLimit);

  const mostUsedScriptUrls = mostUsedScripts.map(
    (scriptPopularity) => scriptPopularity.url
  );
  const sitesUsingMostUsedScriptsCount = countLogfilesWhereSomeScript(
    logfiles,
    (script) => mostUsedScriptUrls.includes(script.url)
  );

  return (
    "<div>" +
    "<ol>" +
    mostUsedScripts
      .map((scriptPopularity) => {
        const url = scriptPopularity.url;
        const flowsCount = scriptPopularity.flowsCount;
        const sitesCount = scriptPopularity.sitesCount;
        const trackingFlags =
          (scriptPopularity.tracking ? "F" : "") +
          (scriptPopularity.cspTracking ? "H" : "");
        return `<li>${url} (${flowsCount} / ${sitesCount}) [${trackingFlags}]</li>`;
      })
      .join("") +
    "</ol>" +
    `<p><i>Showing the top ${mostUsedScriptsLimit} most used scripts out of ${scriptUseRankingList.length}</i></p>` +
    `<p>${sitesUsingMostUsedScriptsCount} sites are using the top ${mostUsedScriptsLimit} most used scripts</p>` +
    "</div>"
  );
}

function renderTable6(logfiles: ClassifiedLogfile[]): string {
  interface XAxisItem {
    label: string;
    predicate: ClassifiedFlowPredicate;
  }
  const xAxis: XAxisItem[] = [
    {
      label: "FilterList",
      predicate: (flow) => flow.tracking,
    },
    {
      label: "NonFilterList",
      predicate: (flow) => !flow.tracking,
    },
  ];

  interface YAxisItem {
    label: string;
    predicate: ClassifiedFlowPredicate;
  }
  const yAxis: YAxisItem[] = [
    {
      label: "Heuristics",
      predicate: (flow) => flow.cspTracking,
    },
    {
      label: "NonHeuristics",
      predicate: (flow) => !flow.cspTracking,
    },
  ];

  const table = new Array<string[]>(yAxis.length);
  for (let row = 0; row < yAxis.length; ++row) {
    const tableRow = new Array<string>(xAxis.length);
    for (let col = 0; col < xAxis.length; ++col) {
      const predicate: ClassifiedFlowPredicate = (flow) =>
        xAxis[col].predicate(flow) && yAxis[row].predicate(flow);
      const flowsCount = countFlows(logfiles, predicate);
      tableRow[col] = `${flowsCount}`;
    }
    table[row] = tableRow;
  }

  return (
    "<table>" +
    "<tr>" +
    "<th>Flows</th>" +
    xAxis.map((item) => `<th>${item.label}</th>`).join("") +
    "</tr>" +
    table
      .map(
        (tableRow, row) =>
          "<tr>" +
          `<th>${yAxis[row].label}</th>` +
          tableRow.map((tableData) => `<td>${tableData}</td>`).join("") +
          "</tr>"
      )
      .join("") +
    "</table>"
  );
}

function renderTable7(logfiles: ClassifiedLogfile[]): string {
  interface XAxisItem {
    label: string;
    predicate: ClassifiedScriptPredicate;
  }
  const xAxis: XAxisItem[] = [
    {
      label: "FilterList",
      predicate: (script) => script.tracking,
    },
    {
      label: "NonFilterList",
      predicate: (script) => !script.tracking,
    },
  ];

  interface YAxisItem {
    label: string;
    predicate: ClassifiedScriptPredicate;
  }
  const yAxis: YAxisItem[] = [
    {
      label: "Heuristics",
      predicate: (script) => script.cspTracking,
    },
    {
      label: "NonHeuristics",
      predicate: (script) => !script.cspTracking,
    },
  ];

  const table = new Array<string[]>(yAxis.length);
  for (let row = 0; row < yAxis.length; ++row) {
    const tableRow = new Array<string>(xAxis.length);
    for (let col = 0; col < xAxis.length; ++col) {
      const predicate: ClassifiedScriptPredicate = (script) =>
        xAxis[col].predicate(script) && yAxis[row].predicate(script);
      const scriptsCount = countScripts(logfiles, predicate);
      tableRow[col] = `${scriptsCount}`;
    }
    table[row] = tableRow;
  }

  return (
    "<table>" +
    "<tr>" +
    "<th>Scripts</th>" +
    xAxis.map((item) => `<th>${item.label}</th>`).join("") +
    "</tr>" +
    table
      .map(
        (tableRow, row) =>
          "<tr>" +
          `<th>${yAxis[row].label}</th>` +
          tableRow.map((tableData) => `<td>${tableData}</td>`).join("") +
          "</tr>"
      )
      .join("") +
    "</table>"
  );
}

function renderSelectedSitesForGDPRCompliance(
  logfiles: ClassifiedLogfile[]
): string {
  const anyFlowLogfiles = logfiles.filter(
    (classifiedLogfile) => classifiedLogfile.flowCollection.length > 0
  );

  const [fhPosLogfiles, fhNegLogfiles] = [
    anyFlowLogfiles
      .filter((classifiedLogfile) =>
        classifiedLogfile.flowCollection.some(
          (classifiedFlow) =>
            classifiedFlow.tracking && classifiedFlow.cspTracking
        )
      )
      .map(
        (classifiedLogfile): ClassifiedLogfile => ({
          ...classifiedLogfile,
          flowCollection: classifiedLogfile.flowCollection.filter(
            (classifiedFlow) =>
              classifiedFlow.tracking && classifiedFlow.cspTracking
          ),
        })
      )
      .sort((a, b) => b.flowCollection.length - a.flowCollection.length),
    anyFlowLogfiles
      .filter(
        (classifiedLogfile) =>
          !classifiedLogfile.flowCollection.some(
            (classifiedFlow) =>
              classifiedFlow.tracking && classifiedFlow.cspTracking
          )
      )
      .sort((a, b) => b.flowCollection.length - a.flowCollection.length),
  ];

  const selectionLimit = 100;
  const selectedFHPosSites = fhPosLogfiles
    .slice(0, selectionLimit)
    .map((classifiedLogfile) => classifiedLogfile.site);
  const selectedFHNegSites = fhNegLogfiles
    .slice(0, selectionLimit)
    .map((classifiedLogfile) => classifiedLogfile.site);

  return (
    "<div>" +
    `<p>no. sites in FH_pos: ${fhPosLogfiles.length}</p>` +
    `<p>no. sites in FH_neg: ${fhNegLogfiles.length}</p>` +
    "<h4>Selected sites in FH_pos</h4>" +
    "<ol>" +
    selectedFHPosSites.map((site) => `<li>${site}</li>`).join("") +
    "</ol>" +
    "<h4>Selected sites in FH_neg</h4>" +
    "<ol>" +
    selectedFHNegSites.map((site) => `<li>${site}</li>`).join("") +
    "</ol>" +
    "<h4>Sites in FH_pos:</h4>" +
    `<p>${JSON.stringify(fhPosLogfiles.map((logfile) => logfile.site))}</p>` +
    "</div>"
  );
}

function renderPrivacyImplications(logfiles: ClassifiedLogfile[]): string {
  const xsTrackingSitesCount = countLogfiles(
    logfiles,
    (logfile) => logfile.xsTracking
  );
  const iframeLocalStorageIsUsedCount = countLogfiles(
    logfiles,
    (logfile) => logfile.iframeLocalStorageIsUsed
  );

  const xsTrackingIframeOriginRankingList = (() => {
    const popularityMap = new Map<string, number>();
    for (const logfile of logfiles) {
      for (const iframeOrigin of logfile.xsTrackingOrigins) {
        popularityMap.set(
          iframeOrigin,
          (popularityMap.get(iframeOrigin) || 0) + 1
        );
      }
    }
    return [...popularityMap.entries()]
      .map(([iframeOrigin, count]) => ({
        iframeOrigin,
        count,
        inFilterList: logfiles.some((logfile) =>
          logfile.xsTrackingOriginsInFilterList.includes(iframeOrigin)
        ),
      }))
      .sort((a, b) => b.count - a.count);
  })();

  const wsSyncingFlowsCount = countFlows(logfiles, (flow) => flow.wsSyncing);
  const wsSyncingFlowsSitesCount = countLogfilesWhereSomeFlow(
    logfiles,
    (flow) => flow.wsSyncing
  );

  const trackingFlowsPredicate: ClassifiedFlowPredicate = (flow) =>
    flow.tracking && flow.cspTracking;
  const localStorageToNetworkFlowsPredicate: ClassifiedFlowPredicate = (flow) =>
    flow.confidentiality &&
    flow.local &&
    (checkBitmap(flow.categoryBits, CategoryFlags.SINK_NETWORK) ||
      checkBitmap(flow.categoryBits, CategoryFlags.SINK_COOKIE));
  const localStorageToNetworkTrackingFlowsPredicate: ClassifiedFlowPredicate = (
    flow
  ) =>
    flow.tracking &&
    flow.cspTracking &&
    flow.confidentiality &&
    flow.local &&
    (checkBitmap(flow.categoryBits, CategoryFlags.SINK_NETWORK) ||
      checkBitmap(flow.categoryBits, CategoryFlags.SINK_COOKIE));

  return (
    "<div>" +
    "<h4>Cross-site tracking</h4>" +
    `<p>no. sites where cross-site tracking is detected: ${xsTrackingSitesCount}</p>` +
    `<p>no. sites where localStorage is used in some iframe: ${iframeLocalStorageIsUsedCount}</p>` +
    "<h4>Web storage syncing</h4>" +
    `<p>no. web storage syncing flows: ${wsSyncingFlowsCount}</p>` +
    `<p>no. sites with web storage syncing flows: ${wsSyncingFlowsSitesCount}</p>` +
    `<p>no. FH-tracking flows: ${countFlows(
      logfiles,
      trackingFlowsPredicate
    )}</p>` +
    `<p>no. sites with FH-tracking flows: ${countLogfilesWhereSomeFlow(
      logfiles,
      trackingFlowsPredicate
    )}</p>` +
    `<p>no. localStorage.getItem &rarr; Network flows: ${countFlows(
      logfiles,
      localStorageToNetworkFlowsPredicate
    )}</p>` +
    `<p>no. sites with localStorage.getItem &rarr; Network flows: ${countLogfilesWhereSomeFlow(
      logfiles,
      localStorageToNetworkFlowsPredicate
    )}</p>` +
    `<p>no. localStorage.getItem &rarr; Network FH-tracking flows: ${countFlows(
      logfiles,
      localStorageToNetworkTrackingFlowsPredicate
    )}</p>` +
    `<p>no. sites with localStorage.getItem &rarr; Network FH-tracking flows: ${countLogfilesWhereSomeFlow(
      logfiles,
      localStorageToNetworkTrackingFlowsPredicate
    )}</p>` +
    "<h4>Cross-site tracking iframe origin ranking list</h4>" +
    "<ol>" +
    xsTrackingIframeOriginRankingList
      .map(
        (item) =>
          `<li>${item.iframeOrigin} (${item.count}) [${
            item.inFilterList ? "F" : ""
          }]</li>`
      )
      .join("") +
    "</ol>" +
    `<p><i>${
      logfiles.filter(
        (logfile) => logfile.xsTrackingOriginsInFilterList.length > 0
      ).length
    } domains exhibits potential for cross-site tracking where the domain in the iframe occurs in a filter list</i></p>` +
    "</div>"
  );
}

function renderReport(logfiles: ClassifiedLogfile[]): string {
  const statsHtml = renderStats(logfiles);
  const table2Html = renderTable2(logfiles);
  const table3Html = renderTable3(logfiles);
  const table4Html = renderTable4(logfiles);
  const scriptUseRankingListHtml = renderScriptUseRankingList(logfiles);
  const table6Html = renderTable6(logfiles);
  const table7Html = renderTable7(logfiles);
  const selectedSitesForGDPRComplianceHtml =
    renderSelectedSitesForGDPRCompliance(logfiles);
  const privacyImplications = renderPrivacyImplications(logfiles);

  return (
    "<!doctype html>" +
    "<head>" +
    "<style>" +
    "div, p, ul, ol { margin-block-start: 0.5em; margin-block-end: 0.5em; }" +
    "table, th, td { border-collapse: collapse; border: solid 1px black; padding: 8px }" +
    "</style>" +
    "</head>" +
    "<body>" +
    "<h2>Stats</h2>" +
    statsHtml +
    "<h2>Table 2</h2>" +
    table2Html +
    "<h2>Table 3</h2>" +
    table3Html +
    "<h2>Table 4</h2>" +
    table4Html +
    "<h2>Script Use Ranking List</h2>" +
    scriptUseRankingListHtml +
    "<h2>Table 6</h2>" +
    table6Html +
    "<h2>Table 7</h2>" +
    table7Html +
    "<h2>Selected sites for GDPR compliance</h2>" +
    selectedSitesForGDPRComplianceHtml +
    "<h2>Privacy implications</h2>" +
    privacyImplications +
    "</body>" +
    "</html>"
  );
}

export { renderReport };
