import * as babel from "@babel/core";
import esnstrument from "./esnstrument";

async function instrumentHtml(
  code: string,
  opts: InstrumentOptions
): Promise<string> {
  return esnstrument(code, "html", opts.url);
}

export { instrumentHtml };

async function instrumentJavaScript(
  code: string,
  opts: InstrumentOptions
): Promise<string> {
  const result = await babel.transformAsync(code, {
    presets: ["@babel/preset-env"],
    sourceType: "script",
    parserOpts: {
      allowReturnOutsideFunction: true,
    },
  });
  const transpiled = result?.code ?? undefined;
  if (transpiled) {
    return await esnstrument(transpiled, "js", opts.url);
  } else {
    throw new Error("Cannot transpile script code with Babel.");
  }
}

export { instrumentJavaScript };

interface InstrumentOptions {
  url: string;
  target: "html" | "js";
}

export { InstrumentOptions };
