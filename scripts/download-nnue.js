/**
 * Postinstall wrapper around `expo-stockfish download-nnue`.
 *
 * The package's own downloader has a 30s socket timeout and no retries,
 * which makes it flaky on CI (EAS build servers). This wrapper retries the
 * CLI a few times, then falls back to curl (`--retry`, generous timeouts)
 * writing directly into the package's Stockfish source dir.
 */

const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const CLI_ATTEMPTS = 3;
const RETRY_DELAY_MS = 5000;

const PACKAGE_ROOT = path.dirname(
  require.resolve("@og-nav/expo-stockfish/package.json")
);
const NNUE_DIR = path.join(PACKAGE_ROOT, "cpp", "Stockfish", "src");
const BASE_URL = "https://tests.stockfishchess.org/api/nn/";

// Stockfish 17 networks — must match the package's nnue-manifest.json
const EXPECTED_FILES = {
  "nn-5227780996d3.nnue": 88420814,
  "nn-37f18f62d772.nnue": 3519630,
};

function allFilesPresent() {
  return Object.entries(EXPECTED_FILES).every(([name, size]) => {
    const p = path.join(NNUE_DIR, name);
    return fs.existsSync(p) && fs.statSync(p).size === size;
  });
}

function sleepSync(ms) {
  spawnSync(process.execPath, ["-e", `setTimeout(()=>{}, ${ms})`]);
}

function tryCli() {
  const result = spawnSync("npx", ["expo-stockfish", "download-nnue"], {
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  return result.status === 0 && allFilesPresent();
}

function tryCurl() {
  fs.mkdirSync(NNUE_DIR, { recursive: true });
  for (const [name, size] of Object.entries(EXPECTED_FILES)) {
    const dest = path.join(NNUE_DIR, name);
    if (fs.existsSync(dest) && fs.statSync(dest).size === size) {
      console.log(`[nnue] ${name} already present, skipping.`);
      continue;
    }
    console.log(`[nnue] curl fallback: downloading ${name}...`);
    const result = spawnSync(
      "curl",
      [
        "-fL",
        "--retry", "8",
        "--retry-all-errors",
        "--connect-timeout", "30",
        "--speed-limit", "1024", // abort if <1KB/s...
        "--speed-time", "60",    // ...for 60s straight (stalled)
        "-o", dest,
        BASE_URL + name,
      ],
      { stdio: "inherit" }
    );
    if (result.status !== 0) {
      try { fs.unlinkSync(dest); } catch (_) {}
      return false;
    }
    const got = fs.statSync(dest).size;
    if (got !== size) {
      console.error(`[nnue] ${name} size mismatch (got ${got}, expected ${size})`);
      try { fs.unlinkSync(dest); } catch (_) {}
      return false;
    }
  }
  return allFilesPresent();
}

function main() {
  if (allFilesPresent()) {
    console.log("[nnue] NNUE files already present and verified.");
    return;
  }

  for (let attempt = 1; attempt <= CLI_ATTEMPTS; attempt++) {
    console.log(`[nnue] download attempt ${attempt}/${CLI_ATTEMPTS}...`);
    if (tryCli()) {
      console.log("[nnue] NNUE download complete.");
      return;
    }
    if (attempt < CLI_ATTEMPTS) sleepSync(RETRY_DELAY_MS);
  }

  console.log("[nnue] CLI attempts failed, falling back to curl...");
  if (tryCurl()) {
    console.log("[nnue] NNUE download complete (via curl).");
    return;
  }

  console.error("[nnue] All download attempts failed.");
  process.exit(1);
}

main();
