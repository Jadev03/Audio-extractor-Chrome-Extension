import express, { Request, Response } from "express";
import cors from "cors";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { dirname } from "path";
import { createRequire } from "module";
import { execSync, spawnSync } from "child_process";
import logger, { auditLog } from "./logger.js";

// Import yt-dlp-wrap as CommonJS module using createRequire
const require = createRequire(import.meta.url);
const ytDlpWrapModule = require("yt-dlp-wrap");
const YTDlpWrap = ytDlpWrapModule.default || ytDlpWrapModule;

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());

// Request logging middleware
app.use((req: Request, res: Response, next) => {
  const startTime = Date.now();
  
  // Log request
  logger.info("Incoming request", {
    method: req.method,
    url: req.url,
    ip: req.ip || req.socket.remoteAddress,
    userAgent: req.get("user-agent")
  });

  // Log response when finished
  res.on("finish", () => {
    const duration = Date.now() - startTime;
    logger.info("Request completed", {
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip || req.socket.remoteAddress
    });
  });

  next();
});

// Initialize yt-dlp-wrap
// Check if yt-dlp is available, use python -m yt_dlp if needed
let usePythonModule = false;
try {
  execSync("yt-dlp --version", { stdio: "ignore" });
  logger.info("yt-dlp found in PATH");
} catch {
  // Try python -m yt_dlp
  try {
    execSync("python -m yt_dlp --version", { stdio: "ignore" });
    usePythonModule = true;
    logger.info("Using python -m yt_dlp for yt-dlp execution");
  } catch (err) {
    logger.error("yt-dlp not found. Please install: pip install yt-dlp");
  }
}

// FFmpeg path configuration
const ffmpegDir = "C:\\Users\\THABENDRA\\Desktop\\ffmpeg-2025-06-02-git-688f3944ce-full_build\\ffmpeg-build\\bin";
const ffmpegPath = path.join(ffmpegDir, "ffmpeg.exe");

// Verify ffmpeg exists
if (fs.existsSync(ffmpegPath)) {
  logger.info("FFmpeg found at configured path", { ffmpegPath });
} else {
  logger.warn("FFmpeg not found at configured path. Audio conversion may fail.", { ffmpegPath });
}

const ytDlpWrap = new YTDlpWrap();

// Ensure downloads directory exists
const downloadsDir = path.join(__dirname, "downloads");
if (!fs.existsSync(downloadsDir)) {
  fs.mkdirSync(downloadsDir, { recursive: true });
}

app.post("/extract", async (req: Request, res: Response) => {
  const { youtubeUrl } = req.body;
  const requestId = `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  logger.info("Audio extraction request received", {
    requestId,
    youtubeUrl: youtubeUrl || "missing",
    ip: req.ip || req.socket.remoteAddress
  });

  if (!youtubeUrl) {
    logger.warn("Audio extraction failed: Missing YouTube URL", {
      requestId,
      ip: req.ip || req.socket.remoteAddress
    });
    
    auditLog("EXTRACTION_FAILED", {
      requestId,
      reason: "Missing YouTube URL",
      ip: req.ip || req.socket.remoteAddress
    });

    return res.status(400).json({ 
      success: false, 
      error: "YouTube URL is required" 
    });
  }

  const outputPath = path.join(downloadsDir, `audio-${Date.now()}.mp3`);
  const startTime = Date.now();

  try {
    logger.info("Starting audio extraction", {
      requestId,
      youtubeUrl,
      outputPath
    });

    // Use python -m yt_dlp if yt-dlp is not in PATH
    if (usePythonModule) {
      // Execute using python -m yt_dlp with ffmpeg location and proper format selection
      // Use spawnSync to avoid shell parsing issues on Windows
      const args = [
        "-m", "yt_dlp",
        youtubeUrl,
        "--no-playlist", // Only download single video, not entire playlist
        "--ffmpeg-location", ffmpegDir, // Set ffmpeg location
        "--extract-audio", // Extract audio only
        "--audio-format", "mp3", // Convert to MP3
        "--audio-quality", "0", // Best quality
        "--format", "bestaudio/best", // Prefer best audio format
        "--postprocessor-args", "ffmpeg:-ac 2 -ar 44100", // Ensure stereo 44.1kHz
        "--output", outputPath
      ];
      
      const result = spawnSync("python", args, {
        stdio: "inherit",
        shell: false
      });
      
      if (result.error) {
        throw result.error;
      }
      
      if (result.status !== 0) {
        throw new Error(`yt-dlp process exited with code ${result.status}`);
      }
    } else {
      await ytDlpWrap.exec([
        youtubeUrl,
        "--no-playlist", // Only download single video, not entire playlist
        "--ffmpeg-location", ffmpegDir, // Set ffmpeg location
        "--extract-audio", // Extract audio only
        "--audio-format", "mp3", // Convert to MP3
        "--audio-quality", "0", // Best quality
        "--format", "bestaudio/best", // Prefer best audio format
        "--postprocessor-args", "ffmpeg:-ac 2 -ar 44100", // Ensure stereo 44.1kHz
        "--output", outputPath
      ]);
    }

    // Check if file was created
    if (!fs.existsSync(outputPath)) {
      throw new Error("Audio file was not created");
    }

    const fileName = path.basename(outputPath);
    const fileSize = fs.statSync(outputPath).size;
    const duration = Date.now() - startTime;

    logger.info("Audio extraction successful", {
      requestId,
      youtubeUrl,
      fileName,
      fileSize: `${(fileSize / 1024 / 1024).toFixed(2)} MB`,
      duration: `${duration}ms`
    });

    auditLog("EXTRACTION_SUCCESS", {
      requestId,
      youtubeUrl,
      fileName,
      fileSize,
      duration,
      ip: req.ip || req.socket.remoteAddress
    });

    res.json({
      success: true,
      fileUrl: `http://localhost:5000/downloads/${fileName}`
    });

  } catch (err) {
    const duration = Date.now() - startTime;
    let errorMessage = err instanceof Error ? err.message : "Unknown error occurred";
    const errorStack = err instanceof Error ? err.stack : undefined;

    // Check for yt-dlp not found error
    if (errorMessage.includes("spawn yt-dlp ENOENT") || errorMessage.includes("ENOENT")) {
      errorMessage = "yt-dlp is not installed or not found in PATH. Please install yt-dlp: pip install yt-dlp";
      logger.error("yt-dlp not found - installation required", {
        requestId,
        youtubeUrl,
        error: errorMessage,
        hint: "Install yt-dlp using: pip install yt-dlp or download from https://github.com/yt-dlp/yt-dlp/releases"
      });
    }

    logger.error("Audio extraction failed", {
      requestId,
      youtubeUrl,
      error: errorMessage,
      stack: errorStack,
      duration: `${duration}ms`
    });

    auditLog("EXTRACTION_FAILED", {
      requestId,
      youtubeUrl,
      error: errorMessage,
      duration,
      ip: req.ip || req.socket.remoteAddress
    });

    res.status(500).json({ 
      success: false, 
      error: errorMessage 
    });
  }
});

// Serve static files from downloads directory
app.use("/downloads", express.static(downloadsDir));

const PORT = 5000;
app.listen(PORT, () => {
  logger.info(`Backend server started`, {
    port: PORT,
    environment: process.env.NODE_ENV || "development",
    timestamp: new Date().toISOString()
  });

  auditLog("SERVER_STARTED", {
    port: PORT,
    environment: process.env.NODE_ENV || "development"
  });
});

// Handle uncaught exceptions
process.on("uncaughtException", (error) => {
  logger.error("Uncaught Exception", {
    error: error.message,
    stack: error.stack
  });
  
  // Don't exit on yt-dlp errors - let the server continue running
  // Only exit on critical errors
  if (!error.message.includes("yt-dlp") && !error.message.includes("ENOENT")) {
    logger.error("Critical error - shutting down server");
    process.exit(1);
  } else {
    logger.warn("Non-critical error - server will continue running");
  }
});

// Handle unhandled promise rejections
process.on("unhandledRejection", (reason, promise) => {
  logger.error("Unhandled Rejection", {
    reason: reason instanceof Error ? reason.message : String(reason),
    stack: reason instanceof Error ? reason.stack : undefined
  });
});
