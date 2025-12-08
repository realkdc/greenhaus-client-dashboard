import ffmpeg from "fluent-ffmpeg";
import ffmpegPath from "@ffmpeg-installer/ffmpeg";
import { promises as fs } from "fs";
import path from "path";
import os from "os";

// Set ffmpeg path
ffmpeg.setFfmpegPath(ffmpegPath.path);

// Extract frames from video at specified intervals
export async function extractVideoFrames(
  videoBuffer: Buffer,
  fileName: string,
  options: {
    maxFrames?: number; // Maximum number of frames to extract
    interval?: number; // Interval in seconds between frames
  } = {}
): Promise<Buffer[]> {
  const { maxFrames = 4, interval = 2 } = options;

  // Create temporary directory for processing
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "video-"));
  const videoPath = path.join(tempDir, fileName);
  const outputPattern = path.join(tempDir, "frame-%03d.jpg");

  try {
    // Write video buffer to temp file
    await fs.writeFile(videoPath, videoBuffer);

    // Extract frames using ffmpeg
    await new Promise<void>((resolve, reject) => {
      ffmpeg(videoPath)
        .outputOptions([
          `-vf fps=1/${interval}`, // Extract 1 frame every N seconds
        ])
        .output(outputPattern)
        .on("end", () => resolve())
        .on("error", (err) => reject(err))
        .run();
    });

    // Read extracted frames
    const files = await fs.readdir(tempDir);
    const frameFiles = files
      .filter((f) => f.startsWith("frame-") && f.endsWith(".jpg"))
      .sort()
      .slice(0, maxFrames); // Limit to maxFrames

    const frames: Buffer[] = [];
    for (const file of frameFiles) {
      const framePath = path.join(tempDir, file);
      const buffer = await fs.readFile(framePath);
      frames.push(buffer);
    }

    return frames;
  } finally {
    // Cleanup temp directory
    try {
      const files = await fs.readdir(tempDir);
      for (const file of files) {
        await fs.unlink(path.join(tempDir, file));
      }
      await fs.rmdir(tempDir);
    } catch (error) {
      console.error("Error cleaning up temp directory:", error);
    }
  }
}

// Get video duration in seconds
export async function getVideoDuration(
  videoBuffer: Buffer,
  fileName: string
): Promise<number> {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "video-"));
  const videoPath = path.join(tempDir, fileName);

  try {
    await fs.writeFile(videoPath, videoBuffer);

    return new Promise<number>((resolve, reject) => {
      ffmpeg.ffprobe(videoPath, (err, metadata) => {
        if (err) {
          reject(err);
        } else {
          resolve(metadata.format.duration || 0);
        }
      });
    });
  } finally {
    // Cleanup
    try {
      await fs.unlink(videoPath);
      await fs.rmdir(tempDir);
    } catch (error) {
      console.error("Error cleaning up temp files:", error);
    }
  }
}

// Check if file is a video based on MIME type
export function isVideoFile(mimeType: string): boolean {
  return mimeType.startsWith("video/");
}

// Get appropriate frame extraction interval based on video duration
export function getFrameInterval(durationSeconds: number, maxFrames: number = 4): number {
  // Calculate interval to get approximately maxFrames evenly distributed
  const interval = Math.max(1, Math.floor(durationSeconds / maxFrames));
  return interval;
}
