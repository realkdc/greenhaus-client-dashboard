import { google } from "googleapis";
import * as dotenv from "dotenv";

// Load local env vars
dotenv.config({ path: ".env.local" });

function formatPrivateKey(key: string | undefined): string | undefined {
  if (!key) return undefined;
  
  let formattedKey = key.replace(/\\n/g, "\n");
  
  if (formattedKey.startsWith('"') && formattedKey.endsWith('"')) {
    formattedKey = formattedKey.slice(1, -1);
  }
  if (formattedKey.startsWith("'") && formattedKey.endsWith("'")) {
    formattedKey = formattedKey.slice(1, -1);
  }

  // Single-line fix
  if (!formattedKey.includes("\n")) {
    const beginHeader = "-----BEGIN PRIVATE KEY-----";
    const endHeader = "-----END PRIVATE KEY-----";
    if (formattedKey.includes(beginHeader) && formattedKey.includes(endHeader)) {
      formattedKey = formattedKey
        .replace(beginHeader, beginHeader + "\n")
        .replace(endHeader, "\n" + endHeader);
    }
  }

  return formattedKey.trim();
}

async function testConnection() {
  console.log("\n--- Google Drive Connection Test ---\n");

  const clientEmail = process.env.GOOGLE_DRIVE_CLIENT_EMAIL || process.env.FIREBASE_CLIENT_EMAIL;
  const rawKey = process.env.GOOGLE_DRIVE_PRIVATE_KEY || process.env.FIREBASE_PRIVATE_KEY;
  const privateKey = formatPrivateKey(rawKey);

  console.log(`Email Configured: ${clientEmail ? 'YES (' + clientEmail + ')' : 'NO'}`);
  console.log(`Private Key Configured: ${rawKey ? 'YES' : 'NO'}`);

  if (privateKey) {
     console.log(`Key Format Check:
     - Length: ${privateKey.length}
     - Has Newlines: ${privateKey.includes('\n')}
     - Has Header: ${privateKey.includes('-----BEGIN PRIVATE KEY-----')}
     - First Line: ${privateKey.split('\n')[0]}
     `);
  }

  if (!clientEmail || !privateKey) {
    console.error("❌ Missing credentials in .env.local");
    return;
  }

  try {
    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: clientEmail,
        private_key: privateKey,
      },
      scopes: ["https://www.googleapis.com/auth/drive.readonly"],
    });

    const drive = google.drive({ version: "v3", auth });
    console.log("Attempting to list files...");
    
    // Try to list 1 file to verify auth
    await drive.files.list({ pageSize: 1 });
    console.log("\n✅ SUCCESS! Credentials are valid and working locally.");
  } catch (error: any) {
    console.error("\n❌ CONNECTION FAILED:");
    console.error(error.message);
    if (error.message.includes("DECODER")) {
        console.log("\n>>> DIAGNOSIS: The Private Key is malformed. It is likely missing newlines or headers.");
    }
  }
}

testConnection();
