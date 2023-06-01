import childProcess from "child_process";
import fsPromises from "fs/promises";
import os from "os";
import path from "path";

async function esnstrument(
  code: string,
  target: "html" | "js",
  url: string
): Promise<string> {
  const outDir = await fsPromises.mkdtemp(path.join(os.tmpdir(), "ytjs-"));
  const originalFile = `index.${target}`;
  const instrumentedFile = `index-jalangi.${target}`;

  await fsPromises.writeFile(path.join(outDir, originalFile), code);

  const proc = childProcess.spawn(
    "node",
    [
      path.join(
        "..",
        "node_modules",
        "jalangi2",
        "src",
        "js",
        "commands",
        "esnstrument_cli.js"
      ),
      "--analysis",
      path.join("runtime", "build", "analysis.js"),
      "--inlineIID",
      "--inlineSource",
      "--noResultsGUI",
      "--outDir",
      outDir,
      "--out",
      path.join(outDir, instrumentedFile),
      "--url",
      url,
      path.join(outDir, originalFile),
    ],
    {
      env: {},
      stdio: "ignore",
    }
  );

  await new Promise((resolve, reject) => {
    proc.on("exit", function (code, signal) {
      resolve({ code: code, signal: signal });
    });
    proc.on("error", function (err) {
      reject(err);
    });
  });

  const instrumented = await fsPromises.readFile(
    path.join(outDir, instrumentedFile),
    { encoding: "utf8" }
  );

  fsPromises.rm(outDir, { force: true, recursive: true });

  return instrumented;
}

export default esnstrument;
