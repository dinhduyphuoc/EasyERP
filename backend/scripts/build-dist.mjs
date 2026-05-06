import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");
const distRoot = path.join(projectRoot, "dist");
const tscEntrypoint = path.join(
  projectRoot,
  "node_modules",
  "typescript",
  "bin",
  "tsc",
);

const run = (command, args) => {
  execFileSync(command, args, {
    cwd: projectRoot,
    stdio: "inherit",
  });
};

const resolveImportTarget = (fromFile, specifier) => {
  if (specifier.startsWith("@/")) {
    return path.join(distRoot, "src", specifier.slice(2));
  }

  if (specifier.startsWith("@lib/")) {
    return path.join(distRoot, "lib", specifier.slice(5));
  }

  if (specifier.startsWith("./") || specifier.startsWith("../")) {
    return path.resolve(path.dirname(fromFile), specifier);
  }

  return null;
};

const toImportSpecifier = (fromFile, targetBasePath) => {
  const jsCandidate = `${targetBasePath}.js`;
  const indexCandidate = path.join(targetBasePath, "index.js");

  let resolvedTarget = null;

  if (existsSync(jsCandidate)) {
    resolvedTarget = jsCandidate;
  } else if (existsSync(indexCandidate)) {
    resolvedTarget = indexCandidate;
  }

  if (!resolvedTarget) {
    return null;
  }

  const relativePath = path.relative(path.dirname(fromFile), resolvedTarget).replaceAll("\\", "/");
  return relativePath.startsWith(".") ? relativePath : `./${relativePath}`;
};

const rewriteFileImports = (filePath) => {
  const source = readFileSync(filePath, "utf8");
  const rewritten = source.replace(
    /(from\s+["'])([^"']+)(["'])|(import\(\s*["'])([^"']+)(["']\s*\))/g,
    (match, fromPrefix, fromSpecifier, fromSuffix, importPrefix, importSpecifier, importSuffix) => {
      const specifier = fromSpecifier ?? importSpecifier;

      if (!specifier) {
        return match;
      }

      const targetBasePath = resolveImportTarget(filePath, specifier);

      if (!targetBasePath) {
        return match;
      }

      const nextSpecifier = toImportSpecifier(filePath, targetBasePath);

      if (!nextSpecifier) {
        return match;
      }

      if (fromPrefix && fromSuffix) {
        return `${fromPrefix}${nextSpecifier}${fromSuffix}`;
      }

      if (importPrefix && importSuffix) {
        return `${importPrefix}${nextSpecifier}${importSuffix}`;
      }

      return match;
    },
  );

  if (rewritten !== source) {
    writeFileSync(filePath, rewritten, "utf8");
  }
};

const walkAndRewrite = (directory) => {
  for (const entry of readdirSync(directory)) {
    const fullPath = path.join(directory, entry);
    const stats = statSync(fullPath);

    if (stats.isDirectory()) {
      walkAndRewrite(fullPath);
      continue;
    }

    if (fullPath.endsWith(".js")) {
      rewriteFileImports(fullPath);
    }
  }
};

rmSync(distRoot, { recursive: true, force: true });
run(process.execPath, [tscEntrypoint, "-p", "tsconfig.build.json"]);

cpSync(path.join(projectRoot, "generated"), path.join(distRoot, "generated"), { recursive: true });

const globalBundlePath = path.join(projectRoot, "global-bundle.pem");
if (existsSync(globalBundlePath)) {
  mkdirSync(distRoot, { recursive: true });
  cpSync(globalBundlePath, path.join(distRoot, "global-bundle.pem"));
}

walkAndRewrite(distRoot);
