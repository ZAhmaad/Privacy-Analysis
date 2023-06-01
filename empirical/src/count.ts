import * as fsPromises from "fs/promises";
import { ClassifiedLogfile } from "./lib/classificator";
import { renderReport } from "./lib/report";

async function main() {
  const classifiedLogfiles = JSON.parse(
    (await fsPromises.readFile("classified.json")).toString()
  ) as ClassifiedLogfile[];

  await fsPromises.writeFile("report.html", renderReport(classifiedLogfiles));
}

main();
