import assert from "assert";
import * as fsPromises from "fs/promises";

function getArgFile(args: any): string {
  const arg = args["file"];
  assert(typeof arg === "string", "Provide an input file");
  return arg;
}

function getArgOffset(args: any): number | undefined {
  const arg = args["offset"];
  if (arg !== undefined) {
    assert(typeof arg === "number", "offset must be a number");
    return arg;
  }
}

function getArgLength(args: any): number | undefined {
  const arg = args["length"];
  if (arg !== undefined) {
    assert(typeof arg === "number", "length must be a number");
    return arg;
  }
}

export { getArgFile, getArgOffset, getArgLength };

async function readSiteListFromTrancoListFile(
  filePath: string,
  offset?: number,
  length?: number
): Promise<string[]> {
  if (offset !== undefined) {
    assert(
      offset >= 0,
      `offset must be a non-negative number, received: ${offset}`
    );
  } else {
    offset = 0;
  }
  if (length !== undefined) {
    assert(length > 0, `length must be a positive number, received: ${length}`);
  } else {
    length = Infinity;
  }
  const text = (await fsPromises.readFile(filePath)).toString();
  return text
    .split(/\r?\n/)
    .filter((x) => x)
    .map((line) => line.substring(line.indexOf(",") + 1))
    .slice(offset, offset + length);
}

export { readSiteListFromTrancoListFile };
