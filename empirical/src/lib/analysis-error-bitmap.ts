import { Logfile } from "@yuantijs/core";

enum AnalysisErrorFlags {
  LOADING_TIMEOUT = 0x01,
  NAVIGATION_ERROR = 0x02,
  INSTRUMENTATION_FAILURE = 0x04,
  RUNTIME_ERROR = 0x08,
  EVALUATION_TIMEOUT = 0x10,
  EVALUATION_ERROR = 0x20,
  ASSERTION_ERROR = 0x40,
}

export default AnalysisErrorFlags;

function getAnalysisErrorBitmapByLogfile(logfile: Logfile) {
  let bitmap = 0;
  for (const error of logfile.errorCollection) {
    switch (error.type) {
      case "loading-timeout":
        bitmap |= AnalysisErrorFlags.LOADING_TIMEOUT;
        break;
      case "navigation-error":
        bitmap |= AnalysisErrorFlags.NAVIGATION_ERROR;
        break;
      case "instrumentation-failure":
        bitmap |= AnalysisErrorFlags.INSTRUMENTATION_FAILURE;
        break;
      case "runtime-error":
        bitmap |= AnalysisErrorFlags.RUNTIME_ERROR;
        break;
      case "evaluation-timeout":
        bitmap |= AnalysisErrorFlags.EVALUATION_TIMEOUT;
        break;
      case "evaluation-error":
        bitmap |= AnalysisErrorFlags.EVALUATION_ERROR;
        break;
      case "assertion-error":
        bitmap |= AnalysisErrorFlags.ASSERTION_ERROR;
        break;
    }
  }
  return bitmap;
}

export { getAnalysisErrorBitmapByLogfile };
