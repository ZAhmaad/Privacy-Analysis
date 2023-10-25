
type AnalysisError =
  { browserKey?: string } & (
    | { type: "loading-timeout"; url: string }
    | { type: "navigation-error"; url: string; message: string }
    | { type: "instrumentation-failure"; url: string }
    | { type: "runtime-error"; message: string }
    | { type: "evaluation-timeout" }
    | { type: "evaluation-error"; message: string }
    | { type: "assertion-error"; message: string }
  );

export { AnalysisError };