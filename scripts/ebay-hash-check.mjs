// Cross-check the eBay challenge hash independently of the deployed function.
// Usage: node scripts/ebay-hash-check.mjs <challengeCode> <verificationToken> <endpointURL>
// Prints SHA-256( challengeCode + verificationToken + endpointURL ) as lowercase hex.
// Run this with your REAL token privately and compare to what the deployed GET returns.
import { createHash } from "node:crypto";
const [code, token, url] = process.argv.slice(2);
if (!code || !token || !url) {
  console.error("usage: node scripts/ebay-hash-check.mjs <challengeCode> <verificationToken> <endpointURL>");
  process.exit(1);
}
console.log(createHash("sha256").update(code + token + url).digest("hex"));
