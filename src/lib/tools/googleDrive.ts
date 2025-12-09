import { google } from "googleapis";
import { Readable } from "stream";

// Helper to format private key
function formatPrivateKey(key: string | undefined): string | undefined {
  if (!key) return undefined;
  
  // Handle literal \n strings (common in env vars)
  let formattedKey = key.replace(/\\n/g, "\n");
  
  // Remove any surrounding quotes that might have been pasted
  if (formattedKey.startsWith('"') && formattedKey.endsWith('"')) {
    formattedKey = formattedKey.slice(1, -1);
  }
  if (formattedKey.startsWith("'") && formattedKey.endsWith("'")) {
    formattedKey = formattedKey.slice(1, -1);
  }

  return formattedKey;
}

// Initialize Google Drive API with service account
function getDriveClient() {
  const clientEmail = process.env.GOOGLE_DRIVE_CLIENT_EMAIL || process.env.FIREBASE_CLIENT_EMAIL;
  const rawPrivateKey = process.env.GOOGLE_DRIVE_PRIVATE_KEY || process.env.FIREBASE_PRIVATE_KEY;
  const privateKey = formatPrivateKey(rawPrivateKey);

  // Debug logging (safe)
  if (!privateKey) {
    console.error("[Google Drive] Missing private key");
  } else if (process.env.NODE_ENV !== 'production') {
    // Only log key details in non-production or if strictly needed for debugging
    const keyLength = privateKey.length;
    const firstLine = privateKey.split('\n')[0];
    console.log(`[Google Drive] Initializing client. Email: ${clientEmail ? 'Set' : 'Missing'}, Key length: ${keyLength}, Header: ${firstLine}`);
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
