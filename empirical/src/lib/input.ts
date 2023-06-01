import { CompactLogfile, Logfile, expandLogfile } from "@yuantijs/core";
import assert from "assert";
import * as fsPromises from "fs/promises";
import path from "path";

function getArgResults(args: any): string {
  const arg = args["results"];
  assert(typeof arg === "string", "Provide a results/* directory");
  return arg;
}

export { getArgResults };

async function readLogfiles(resultsPath: string): Promise<Logfile[]> {
  const logfiles: Logfile[] = [];
  const resultsContent = await fsPromises.readdir(resultsPath);
  for (const siteName of resultsContent) {
    const sitePath = path.join(resultsPath, siteName);
    const logsPath = path.join(sitePath, "logs.json");
    const json = (await fsPromises.readFile(logsPath)).toString();
    const data = JSON.parse(json) as CompactLogfile;
    const logfile = expandLogfile(data);
    logfiles.push(logfile);
  }
  return logfiles;
}

export { readLogfiles };
