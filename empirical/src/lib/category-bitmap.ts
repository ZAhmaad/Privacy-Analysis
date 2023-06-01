import {
  Flow,
  isCookieLabel,
  isCurrentUrlLabel,
  isNavigatorLabel,
  isNetworkLabel,
  isStorageLabel,
} from "@yuantijs/core";

enum CategoryFlags {
  SOURCE_COOKIE = 0x01,
  SOURCE_CURRENT_URL = 0x02,
  SOURCE_NAVIGATOR = 0x04,
  SOURCE_NETWORK = 0x08,
  SOURCE_STORAGE = 0x10,
  SINK_COOKIE = 0x20,
  SINK_NETWORK = 0x40,
  SINK_STORAGE = 0x80,
}

export default CategoryFlags;

function getCategoryBitmapByFlow(flow: Flow) {
  let bitmap = 0;
  for (const label of flow.taint) {
    if (isCookieLabel(label)) {
      bitmap |= CategoryFlags.SOURCE_COOKIE;
    } else if (isCurrentUrlLabel(label)) {
      bitmap |= CategoryFlags.SOURCE_CURRENT_URL;
    } else if (isNavigatorLabel(label)) {
      bitmap |= CategoryFlags.SOURCE_NAVIGATOR;
    } else if (isNetworkLabel(label)) {
      bitmap |= CategoryFlags.SOURCE_NETWORK;
    } else if (isStorageLabel(label)) {
      bitmap |= CategoryFlags.SOURCE_STORAGE;
    }
  }
  const sinkLabel = flow.sinkLabel;
  if (isCookieLabel(sinkLabel)) {
    bitmap |= CategoryFlags.SINK_COOKIE;
  } else if (isNetworkLabel(sinkLabel)) {
    bitmap |= CategoryFlags.SINK_NETWORK;
  } else if (isStorageLabel(sinkLabel)) {
    bitmap |= CategoryFlags.SINK_STORAGE;
  }
  return bitmap;
}

export { getCategoryBitmapByFlow };
