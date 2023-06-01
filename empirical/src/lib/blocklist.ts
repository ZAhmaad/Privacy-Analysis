import * as fsPromises from "fs/promises";

type Blocklist = BlocklistRule[];

interface BlocklistRule {
  action: BlocklistAction;
  trigger: BlocklistTrigger;
}

interface BlocklistAction {
  type: string;
}

interface BlocklistTrigger {
  "url-filter": string;
  "url-filter-is-case-sensitive"?: boolean;
  "resource-type"?: string[];
  "load-type"?: string[];
  "if-domain"?: string[];
  "unless-domain"?: string[];
}

export { Blocklist, BlocklistRule, BlocklistAction, BlocklistTrigger };

async function readBlocklist(filePath: string): Promise<Blocklist> {
  const json = (await fsPromises.readFile(filePath)).toString();
  return JSON.parse(json) as Blocklist;
}

export { readBlocklist };
