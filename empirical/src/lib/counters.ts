import {
  ClassifiedFlow,
  ClassifiedLogfile,
  ClassifiedScript,
} from "./classificator";

type ClassifiedLogfilePredicate = (logfile: ClassifiedLogfile) => boolean;

function countLogfiles(
  logfiles: ClassifiedLogfile[],
  logfilePredicate: ClassifiedLogfilePredicate
): number {
  return logfiles.filter(logfilePredicate).length;
}

export { ClassifiedLogfilePredicate, countLogfiles };

type ClassifiedFlowPredicate = (flow: ClassifiedFlow) => boolean;

function countFlows(
  logfiles: ClassifiedLogfile[],
  flowPredicate: ClassifiedFlowPredicate
): number {
  return logfiles.flatMap((logfile) =>
    logfile.flowCollection.filter(flowPredicate)
  ).length;
}

function countLogfilesWhereSomeFlow(
  logfiles: ClassifiedLogfile[],
  flowPredicate: ClassifiedFlowPredicate
): number {
  return logfiles.filter((logfile) =>
    logfile.flowCollection.some(flowPredicate)
  ).length;
}

export { ClassifiedFlowPredicate, countFlows, countLogfilesWhereSomeFlow };

type ClassifiedScriptPredicate = (script: ClassifiedScript) => boolean;

function countScripts(
  logfiles: ClassifiedLogfile[],
  scriptPredicate: ClassifiedScriptPredicate
): number {
  return logfiles.filter((logfile) =>
    logfile.scriptCollection.some(scriptPredicate)
  ).length;
}

function countLogfilesWhereSomeScript(
  logfiles: ClassifiedLogfile[],
  scriptPredicate: ClassifiedScriptPredicate
): number {
  return logfiles.filter((logfile) =>
    logfile.scriptCollection.some(scriptPredicate)
  ).length;
}

export {
  ClassifiedScriptPredicate,
  countScripts,
  countLogfilesWhereSomeScript,
};
