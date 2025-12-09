import { google } from "googleapis";
import { Readable } from "stream";

// Helper to format private key
function formatPrivateKey(key: string | undefined): string | undefined {
  if (!key) return undefined;
  
  // 1. Handle literal \n strings (common in env vars)
  let formattedKey = key.replace(/\\n/g, "\n");
  
  // 2. Remove any surrounding quotes
  if (formattedKey.startsWith('"') && formattedKey.endsWith('"')) {
    formattedKey = formattedKey.slice(1, -1);
  }
  if (formattedKey.startsWith("'") && formattedKey.endsWith("'")) {
    formattedKey = formattedKey.slice(1, -1);
  }

  // 3. Fix keys that might be single-line (spaces instead of newlines)
  // This often happens when copying from some terminals or UIs
  if (!formattedKey.includes("\n")) {
    const beginHeader = "-----BEGIN PRIVATE KEY-----";
    const endHeader = "-----END PRIVATE KEY-----";
    
    if (formattedKey.includes(beginHeader) && formattedKey.includes(endHeader)) {
      // It's a one-line key. We need to try to re-format it.
      // Strategy: Extract the body, and assume it's valid base64, then wrap.
      // But simpler strategy: just ensure headers have newlines.
      formattedKey = formattedKey
        .replace(beginHeader, beginHeader + "\n")
        .replace(endHeader, "\n" + endHeader);
        
      // The body might still be one long line, but PEM parsers often handle that 
      // as long as headers are separated. 
      // If it still fails, we might need to chunk the body, but that's risky if we break it wrong.
      // Let's replace spaces in the body with newlines? No, risky.
      // Usually the issue is just the headers.
      console.log("[Google Drive] Detected single-line key, attempted to add newlines around headers.");
    }
  }

  return formattedKey.trim();
}

// Initialize Google Drive API with service account
function getDriveClient() {
  const clientEmail = process.env.GOOGLE_DRIVE_CLIENT_EMAIL || process.env.FIREBASE_CLIENT_EMAIL;
  const rawPrivateKey = process.env.GOOGLE_DRIVE_PRIVATE_KEY || process.env.FIREBASE_PRIVATE_KEY;
  const privateKey = formatPrivateKey(rawPrivateKey);

  // Debug logging
  if (!privateKey) {
    console.error("[Google Drive] Missing private key");
  } else if (process.env.NODE_ENV !== 'production' || true) { // Force log in prod for now to debug
    const keyLength = privateKey.length;
    const hasNewlines = privateKey.includes("\n");
    const hasBegin = privateKey.includes("-----BEGIN PRIVATE KEY-----");
    const hasEnd = privateKey.includes("-----END PRIVATE KEY-----");
    const firstLine = privateKey.split('\n')[0];
    
    console.log(`[Google Drive] Key check - Length: ${keyLength}, Newlines: ${hasNewlines}, Header: ${hasBegin}, Footer: ${hasEnd}, Start: ${firstLine.substring(0, 30)}...`);
  }

  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: clientEmail,
      private_key: privateKey,
    },
    scopes: ["https://www.googleapis.com/auth/drive.readonly"],
  });

  return google.drive({ version: "v3", auth });
}

// Extract file ID from various Google Drive URL formats
export function extractFileId(url: string): string | null {
  // Handle different Google Drive URL formats:
  // https://drive.google.com/file/d/FILE_ID/view
  // https://drive.google.com/open?id=FILE_ID
  // https://drive.google.com/uc?id=FILE_ID

  const patterns = [
    /\/file\/d\/([a-zA-Z0-9_-]+)/,
    /[?&]id=([a-zA-Z0-9_-]+)/,
    /\/d\/([a-zA-Z0-9_-]+)/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) {
      return match[1];
    }
  }

  return null;
}

// Download file from Google Drive
export async function downloadDriveFile(fileId: string): Promise<{
  buffer: Buffer;
  mimeType: string;
  fileName: string;
}> {
  const drive = getDriveClient();

  try {
    // Get file metadata
    const metadata = await drive.files.get({
      fileId: fileId,
      fields: "name, mimeType",
    });

    const fileName = metadata.data.name || "unknown";
    const mimeType = metadata.data.mimeType || "application/octet-stream";

    // Download file content
    const response = await drive.files.get(
      {
        fileId: fileId,
        alt: "media",
      },
      { responseType: "stream" }
    );

    // Convert stream to buffer
    const chunks: Buffer[] = [];
    const stream = response.data as Readable;

    return new Promise((resolve, reject) => {
      stream.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
      stream.on("error", reject);
      stream.on("end", () => {
        resolve({
          buffer: Buffer.concat(chunks),
          mimeType,
          fileName,
        });
      });
    });
  } catch (error: any) {
    if (error?.response?.status === 404) {
      throw new Error("File not found. Make sure the link is shared with anyone who has the link.");
    } else if (error?.response?.status === 403) {
      throw new Error("Access denied. Please share the file with 'Anyone with the link' can view.");
    }
    throw new Error(`Failed to download file from Google Drive: ${error?.message}`);
  }
}

// Check if file is publicly accessible
export async function checkFileAccess(fileId: string): Promise<boolean> {
  const drive = getDriveClient();

  try {
    await drive.files.get({
      fileId: fileId,
      fields: "id",
    });
    return true;
  } catch {
    return false;
  }
}
