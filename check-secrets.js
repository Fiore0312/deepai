const fs = require("fs");
const path = require("path");

// Pattern da trovare
const patterns = [
  /OPENROUTER_API_KEY\s*=\s*['"]?sk-[\w-]+['"]?/i,
  /sk-or-[\w-]+/i,
  /sk-[\w-]{32,}/i,
];

// Dove cercare
const foldersToScan = ["frontend-riformula", "Deep-AI"];

function scanDirectory(dir) {
  let found = [];

  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      found = found.concat(scanDirectory(fullPath));
    } else {
      const content = fs.readFileSync(fullPath, "utf8");
      for (const pattern of patterns) {
        if (pattern.test(content)) {
          found.push(fullPath);
          break;
        }
      }
    }
  }

  return found;
}

const matches = foldersToScan.flatMap(scanDirectory);

if (matches.length > 0) {
  console.error(
    "\x1b[31m%s\x1b[0m",
    "❌ ERROR: Chiavi API potenzialmente esposte trovate nei seguenti file:"
  );
  matches.forEach((file) => console.log("🛑 " + file));
  process.exit(1);
} else {
  console.log(
    "\x1b[32m%s\x1b[0m",
    "✅ Nessuna chiave API trovata, puoi procedere!"
  );
}
