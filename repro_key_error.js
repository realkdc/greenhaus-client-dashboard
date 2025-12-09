const crypto = require('crypto');

function testKey(name, key) {
    try {
        // specific cleaning logic I want to test
        let formattedKey = key;
        if (formattedKey) {
            formattedKey = formattedKey.replace(/\\n/g, "\n");
            if (formattedKey.startsWith('"') && formattedKey.endsWith('"')) {
                formattedKey = formattedKey.slice(1, -1);
            }
             if (formattedKey.startsWith("'") && formattedKey.endsWith("'")) {
                formattedKey = formattedKey.slice(1, -1);
            }
        }
        
        // This is what google-auth-library eventually uses (or similar)
        // It creates credentials.
        // We can just try to create a private key object to validate format
        crypto.createPrivateKey(formattedKey);
        console.log(`[PASS] ${name}`);
    } catch (e) {
        console.log(`[FAIL] ${name}: ${e.message}`);
    }
}

const validKeyContent = "MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQD... (mock) ...";
const header = "-----BEGIN PRIVATE KEY-----";
const footer = "-----END PRIVATE KEY-----";
// Note: crypto.createPrivateKey REQUIRES a valid key structure, so I can't easily mock it without a real key generation.
// But the error "DECODER routines::unsupported" usually implies the HEADER is wrong or missing.

console.log("Unable to fully reproduce without real key, but verifying logic...");

// Test quote stripping
let k1 = '"-----BEGIN PRIVATE KEY-----\\nDATA\\n-----END PRIVATE KEY-----"';
let f1 = k1.replace(/\\n/g, "\n");
if (f1.startsWith('"') && f1.endsWith('"')) f1 = f1.slice(1, -1);
console.log("Quote strip test:", f1.startsWith('-') ? "PASS" : "FAIL", f1);

