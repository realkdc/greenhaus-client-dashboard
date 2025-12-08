import { google } from "googleapis";
import { Readable } from "stream";

// Initialize Google Drive API with service account
function getDriveClient() {
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_DRIVE_CLIENT_EMAIL || process.env.FIREBASE_CLIENT_EMAIL,
      private_key: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
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
