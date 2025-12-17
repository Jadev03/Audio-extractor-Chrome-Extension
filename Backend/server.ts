// Load environment variables from .env file FIRST, before any other imports
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname } from "path";
import path from "path";
import fs from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configure dotenv to load .env file
// Try multiple possible locations
const possibleEnvPaths = [
  path.join(__dirname, ".env"),           // Same directory (development)
  path.join(__dirname, "..", ".env"),     // Parent directory (production from dist)
  path.join(process.cwd(), ".env"),       // Current working directory
  path.join(process.cwd(), "Backend", ".env") // Backend subdirectory
];

let envLoaded = false;
let loadedEnvPath = null;

for (const envPath of possibleEnvPaths) {
  if (fs.existsSync(envPath)) {
    const result = dotenv.config({ path: envPath });
    if (!result.error) {
      envLoaded = true;
      loadedEnvPath = envPath;
      break;
    }
  }
}

// Also try default dotenv.config() as fallback
if (!envLoaded) {
  dotenv.config();
}

// Log environment loading status (before logger is imported)
if (process.env.NODE_ENV !== "production") {
  console.log("[ENV] Environment variables loaded:", {
    envFileFound: envLoaded,
    envFilePath: loadedEnvPath,
    hasClientId: !!process.env.GOOGLE_CLIENT_ID,
    hasClientSecret: !!process.env.GOOGLE_CLIENT_SECRET,
    hasFolderId: !!process.env.GOOGLE_DRIVE_FOLDER_ID,
    __dirname: __dirname,
    cwd: process.cwd()
  });
}

// Now import other modules (they may use process.env)
import express, { Request, Response } from "express";
import cors from "cors";
import { createRequire } from "module";
import { execSync, spawnSync, spawn } from "child_process";
import logger, { auditLog } from "./logger.js";
import { uploadMultipleToDrive, uploadToDrive, getAuthUrl, getTokenFromCode, isDriveConfigured } from "./driveService.js";

// Import yt-dlp-wrap as CommonJS module using createRequire
const require = createRequire(import.meta.url);
const ytDlpWrapModule = require("yt-dlp-wrap");
const YTDlpWrap = ytDlpWrapModule.default || ytDlpWrapModule;

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

// FFmpeg path configuration from .env file
// FFMPEG_DIR: Directory containing ffmpeg.exe (e.g., "C:\\ffmpeg\\bin")
// FFMPEG_PATH: Full path to ffmpeg.exe (e.g., "C:\\ffmpeg\\bin\\ffmpeg.exe")
// If FFMPEG_PATH is set, use it directly; otherwise, construct from FFMPEG_DIR
const ffmpegDir = process.env.FFMPEG_DIR || "";
const ffmpegPath = process.env.FFMPEG_PATH || (ffmpegDir ? path.join(ffmpegDir, "ffmpeg.exe") : "ffmpeg");

// Verify ffmpeg exists
if (ffmpegPath && ffmpegPath !== "ffmpeg") {
  if (fs.existsSync(ffmpegPath)) {
    logger.info("FFmpeg found at configured path", { ffmpegPath, ffmpegDir: ffmpegDir || path.dirname(ffmpegPath) });
  } else {
    logger.warn("FFmpeg not found at configured path. Audio conversion may fail.", { 
      ffmpegPath, 
      ffmpegDir: ffmpegDir || path.dirname(ffmpegPath),
      hint: "Please check FFMPEG_DIR or FFMPEG_PATH in .env file"
    });
  }
} else {
  // Try to find ffmpeg in PATH
  try {
    execSync("ffmpeg -version", { stdio: "ignore" });
    logger.info("FFmpeg found in system PATH");
  } catch {
    logger.warn("FFmpeg not found. Please set FFMPEG_DIR or FFMPEG_PATH in .env file. Audio conversion may fail.");
  }
}

const ytDlpWrap = new YTDlpWrap();

// Ensure downloads directory exists
const downloadsDir = path.join(__dirname, "downloads");
if (!fs.existsSync(downloadsDir)) {
  fs.mkdirSync(downloadsDir, { recursive: true });
}

app.post("/extract", async (req: Request, res: Response) => {
  const { youtubeUrl, facebookUrl, videoUrl } = req.body;
  // Support both old format (youtubeUrl) and new format (videoUrl) for backward compatibility
  const url = videoUrl || youtubeUrl || facebookUrl;
  const requestId = `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  // Detect platform from URL
  const isYouTube = url && (url.includes("youtube.com") || url.includes("youtu.be"));
  const isFacebook = url && (url.includes("facebook.com") || url.includes("fb.com") || url.includes("fb.watch"));
  const platform = isYouTube ? "YouTube" : isFacebook ? "Facebook" : "Unknown";

  logger.info("Audio extraction request received", {
    requestId,
    videoUrl: url || "missing",
    platform,
    ip: req.ip || req.socket.remoteAddress
  });

  if (!url) {
    logger.warn("Audio extraction failed: Missing video URL", {
      requestId,
      ip: req.ip || req.socket.remoteAddress
    });
    
    auditLog("EXTRACTION_FAILED", {
      requestId,
      reason: "Missing video URL",
      ip: req.ip || req.socket.remoteAddress
    });

    return res.status(400).json({ 
      success: false, 
      error: "Video URL is required (YouTube or Facebook)" 
    });
  }

  if (!isYouTube && !isFacebook) {
    logger.warn("Audio extraction failed: Unsupported platform", {
      requestId,
      url: url.substring(0, 50),
      ip: req.ip || req.socket.remoteAddress
    });
    
    return res.status(400).json({ 
      success: false, 
      error: "Unsupported platform. Only YouTube and Facebook URLs are supported." 
    });
  }

  const timestamp = Date.now();
  const webmOutputPath = path.join(downloadsDir, `audio-${timestamp}.webm`);
  const startTime = Date.now();

  try {
    logger.info("Starting audio extraction", {
      requestId,
      videoUrl: url,
      platform,
      outputPath: webmOutputPath
    });

    // Helper function to build base yt-dlp arguments for downloading original WebM audio
    const buildBaseArgs = (includeCookies: boolean = false) => {
      const browserForCookies = process.env.YT_DLP_BROWSER || "chrome";
      const baseArgs = [
        url,
        "--no-playlist", // Only download single video, not entire playlist
        // Download best available audio in WebM container without re-encoding
        "--format",
        "bestaudio[ext=webm]/bestaudio",
        "--output",
        webmOutputPath
      ];
      
      if (includeCookies) {
        baseArgs.splice(2, 0, "--cookies-from-browser", browserForCookies);
      }
      
      return baseArgs;
    };

    // Try extraction with cookies first, fallback to without cookies if it fails
    const tryExtraction = async (withCookies: boolean): Promise<{ success: boolean; error?: string }> => {
      try {
        if (usePythonModule) {
          const args = ["-m", "yt_dlp", ...buildBaseArgs(withCookies)];
          const result = spawnSync("python", args, {
            stdio: "pipe", // Capture output to check for cookie errors
            shell: false
          });
          
          if (result.error) {
            throw result.error;
          }
          
          if (result.status === 0) {
            return { success: true };
          } else {
            // Check if error is related to cookies
            const errorOutput = (result.stderr?.toString() || result.stdout?.toString() || "").toLowerCase();
            if (withCookies && (errorOutput.includes("cookie") || errorOutput.includes("could not copy"))) {
              logger.warn("Cookie extraction failed, will retry without cookies", {
                requestId,
                error: errorOutput.substring(0, 200)
              });
              return { success: false, error: "COOKIE_EXTRACTION_FAILED" };
            } else {
              throw new Error(`yt-dlp process exited with code ${result.status}`);
            }
          }
        } else {
          // For ytDlpWrap, we need to catch errors differently
          try {
            await ytDlpWrap.exec(buildBaseArgs(withCookies));
            return { success: true };
          } catch (wrapError: any) {
            const errorMsg = (wrapError?.message || String(wrapError) || "").toLowerCase();
            if (withCookies && (errorMsg.includes("cookie") || errorMsg.includes("could not copy"))) {
              logger.warn("Cookie extraction failed, will retry without cookies", {
                requestId,
                error: errorMsg.substring(0, 200)
              });
              return { success: false, error: "COOKIE_EXTRACTION_FAILED" };
            }
            throw wrapError;
          }
        }
      } catch (err: any) {
        const errorMsg = err?.message || String(err) || "";
        if (withCookies && (errorMsg.toLowerCase().includes("cookie") || errorMsg.toLowerCase().includes("could not copy"))) {
          return { success: false, error: "COOKIE_EXTRACTION_FAILED" };
        }
        throw err;
      }
    };

    // First attempt: with cookies
    let result = await tryExtraction(true);
    
    // If cookie extraction failed, retry without cookies
    if (!result.success && result.error === "COOKIE_EXTRACTION_FAILED") {
      logger.info("Retrying extraction without cookies", { requestId });
      result = await tryExtraction(false);
    }
    
    // If still failed, throw the error
      if (!result.success) {
        throw new Error(result.error || "Audio extraction failed");
      }

    // Check if file was created
    if (!fs.existsSync(webmOutputPath)) {
      throw new Error("Audio file was not created");
    }

    const fileName = path.basename(webmOutputPath);
    // Get file size safely
    let fileSize = 0;
    try {
      if (fs.existsSync(webmOutputPath)) {
        fileSize = fs.statSync(webmOutputPath).size;
      }
    } catch {
      // File may have been deleted later; ignore
    }
    const duration = Date.now() - startTime;

    // Upload single WebM audio file directly to Google Drive
    let driveUploadInfo: {
      fileId: string;
      webViewLink: string;
      webContentLink: string;
    } | null = null;

    if (isDriveConfigured()) {
      try {
        logger.info("Uploading WebM audio to Google Drive", {
          requestId,
          fileName,
          filePath: webmOutputPath
        });

        const uploaded = await uploadToDrive(webmOutputPath, fileName);
        driveUploadInfo = uploaded;

        logger.info("WebM audio uploaded to Google Drive successfully", {
          requestId,
          fileId: uploaded.fileId,
          webViewLink: uploaded.webViewLink
        });

        // Optionally delete local file after successful upload
        try {
          if (fs.existsSync(webmOutputPath)) {
            fs.unlinkSync(webmOutputPath);
            logger.info("Local WebM file deleted after upload", {
              requestId,
              file: webmOutputPath
            });
          }
        } catch (deleteErr) {
          logger.warn("Failed to delete local WebM file after upload", {
            requestId,
            file: webmOutputPath,
            error: deleteErr instanceof Error ? deleteErr.message : String(deleteErr)
          });
        }
      } catch (uploadError) {
        logger.error("Failed to upload WebM audio to Google Drive", {
          requestId,
          error: uploadError instanceof Error ? uploadError.message : String(uploadError)
        });
        // Don't fail the entire request if upload fails; user still has local file (if not deleted)
      }
    }

    logger.info("Audio extraction successful", {
      requestId,
      videoUrl: url,
      platform,
      fileName,
      fileSize: `${(fileSize / 1024 / 1024).toFixed(2)} MB`,
      duration: `${duration}ms`
    });

    auditLog("EXTRACTION_SUCCESS", {
      requestId,
      videoUrl: url,
      platform,
      fileName,
      fileSize,
      duration,
      ip: req.ip || req.socket.remoteAddress
    });

    // Return response with Google Drive information
    res.json({
      success: true,
      fileName,
      fileSize,
      driveFileId: driveUploadInfo?.fileId || null,
      driveWebViewLink: driveUploadInfo?.webViewLink || null,
      driveWebContentLink: driveUploadInfo?.webContentLink || null,
      message: driveUploadInfo
        ? "WebM audio uploaded to Google Drive"
        : "WebM audio downloaded locally (Google Drive not configured)"
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
        videoUrl: url,
        platform,
        error: errorMessage,
        hint: "Install yt-dlp using: pip install yt-dlp or download from https://github.com/yt-dlp/yt-dlp/releases"
      });
    }

    logger.error("Audio extraction failed", {
      requestId,
      videoUrl: url,
      platform,
      error: errorMessage,
      stack: errorStack,
      duration: `${duration}ms`
    });

    auditLog("EXTRACTION_FAILED", {
      requestId,
      videoUrl: url,
      platform,
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

type ConvertParams = {
  ffmpegPath: string;
  inputFile: string;
  outputFile: string;
  sampleRate: number;
  channels: number;
};

const convertMp3ToWav = (options: ConvertParams) => {
  const { ffmpegPath, inputFile, outputFile, sampleRate, channels } = options;
  const ffmpegBinary = fs.existsSync(ffmpegPath) ? ffmpegPath : "ffmpeg";

  return new Promise<void>((resolve, reject) => {
    const args = [
      "-y",
      "-i",
      inputFile,
      "-ac",
      channels.toString(),
      "-ar",
      sampleRate.toString(),
      outputFile
    ];

    const ffmpegProcess = spawn(ffmpegBinary, args, { stdio: "inherit", shell: false });

    ffmpegProcess.on("error", (error) => reject(error));
    ffmpegProcess.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`FFmpeg exited with code ${code}`));
      }
    });
  });
};

type PythonNoiseReductionParams = {
  pythonBin: string;
  inputFile: string;
  outputFile: string;
  method: string;
  stationary: boolean;
  propDecrease: number;
};

const applyPythonNoiseReduction = (params: PythonNoiseReductionParams): Promise<void> => {
  const noiseReductionScriptPath = path.join(__dirname, "noise_reduction.py");

  if (!fs.existsSync(noiseReductionScriptPath)) {
    throw new Error(`Noise reduction script not found at ${noiseReductionScriptPath}`);
  }

  return new Promise((resolve, reject) => {
    const args = [
      noiseReductionScriptPath,
      "--input",
      params.inputFile,
      "--output",
      params.outputFile,
      "--method",
      params.method,
      "--prop-decrease",
      params.propDecrease.toString()
    ];

    if (params.stationary) {
      args.push("--stationary");
    }

    logger.info("Running Python noise reduction", {
      method: params.method,
      stationary: params.stationary,
      propDecrease: params.propDecrease
    });

    const pythonProcess = spawn(params.pythonBin, args, { shell: false });
    let stdout = "";
    let stderr = "";

    pythonProcess.stdout.on("data", (data) => {
      stdout += data.toString();
    });

    pythonProcess.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    pythonProcess.on("error", (error) => {
      reject(new Error(`Failed to start noise reduction process: ${error.message}`));
    });

    pythonProcess.on("close", (code) => {
      if (code !== 0) {
        return reject(new Error(stderr || `Noise reduction script exited with code ${code}`));
      }

      try {
        const result = JSON.parse(stdout);
        if (result.success) {
          logger.info("Noise reduction completed successfully", {
            method: result.method,
            duration: result.duration
          });
          resolve();
        } else {
          reject(new Error(result.error || "Noise reduction failed"));
        }
      } catch (err) {
        // If output is not JSON, check if file was created
        if (fs.existsSync(params.outputFile)) {
          logger.info("Noise reduction completed (no JSON output)", {
            outputFile: params.outputFile
          });
          resolve();
        } else {
          reject(
            new Error(
              `Failed to parse noise reduction output: ${
                err instanceof Error ? err.message : String(err)
              } | Raw output: ${stdout} | Errors: ${stderr}`
            )
          );
        }
      }
    });
  });
};

type VadParams = {
  pythonBin: string;
  inputWav: string;
  outputDir: string;
  prefix: string;
  minSilenceMs: number;
  minSpeechMs: number;
  sentencePauseMs: number;
  maxSegmentSeconds: number;
  silenceThreshold: number;
};

type VadResult = {
  segments: Array<{ file: string; start: number; end: number }>;
  segmentsDir: string;
  segmentsCount: number;
  totalSpeechMs: number;
};

const runSileroVad = (params: VadParams): Promise<VadResult> => {
  const vadScriptPath = path.join(__dirname, "vad_split.py");

  if (!fs.existsSync(vadScriptPath)) {
    throw new Error(`VAD script not found at ${vadScriptPath}`);
  }

  return new Promise((resolve, reject) => {
    const args = [
      vadScriptPath,
      "--input",
      params.inputWav,
      "--output",
      params.outputDir,
      "--prefix",
      params.prefix,
      "--min-silence",
      params.minSilenceMs.toString(),
      "--min-speech",
      params.minSpeechMs.toString(),
      "--sentence-pause",
      params.sentencePauseMs.toString(),
      "--max-segment-seconds",
      params.maxSegmentSeconds.toString(),
      "--silence-threshold",
      params.silenceThreshold.toString()
    ];

    const pythonProcess = spawn(params.pythonBin, args, { shell: false });
    let stdout = "";
    let stderr = "";

    pythonProcess.stdout.on("data", (data) => {
      stdout += data.toString();
    });

    pythonProcess.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    pythonProcess.on("error", (error) => {
      reject(error);
    });

    pythonProcess.on("close", (code) => {
      if (code !== 0) {
        return reject(new Error(stderr || `VAD script exited with code ${code}`));
      }

      try {
        const parsed = JSON.parse(stdout);
        resolve({
          segments: parsed.segments || [],
          segmentsDir: params.outputDir,
          segmentsCount: parsed.segmentsCount || parsed.segments?.length || 0,
          totalSpeechMs: parsed.totalSpeechMs || 0
        });
      } catch (err) {
        reject(
          new Error(
            `Failed to parse VAD output: ${
              err instanceof Error ? err.message : String(err)
            } | Raw output: ${stdout}`
          )
        );
      }
    });
  });
};

// Google Drive OAuth endpoints
app.get("/auth/google", (req: Request, res: Response) => {
  try {
    const authUrl = getAuthUrl();
    res.json({ authUrl });
  } catch (error) {
    logger.error("Error generating auth URL", {
      error: error instanceof Error ? error.message : String(error)
    });
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to generate auth URL"
    });
  }
});

app.get("/oauth2callback", async (req: Request, res: Response) => {
  const code = req.query.code as string;
  
  if (!code) {
    return res.status(400).send(`
      <html>
        <body>
          <h1>Authorization Failed</h1>
          <p>No authorization code received.</p>
          <p><a href="/auth/google">Try again</a></p>
        </body>
      </html>
    `);
  }

  try {
    logger.info("Exchanging authorization code for token", { code: code.substring(0, 10) + "..." });
    const tokenData = await getTokenFromCode(code);
    
    // Verify token was saved
    const tokenPath = path.join(__dirname, "token.json");
    const tokenSaved = fs.existsSync(tokenPath);
    
    logger.info("OAuth token saved successfully", {
      hasRefreshToken: !!tokenData.refresh_token,
      hasAccessToken: !!tokenData.access_token,
      tokenFileExists: tokenSaved
    });
    
    res.send(`
      <html>
        <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
          <h1 style="color: #34a853;">✅ Authorization Successful!</h1>
          <p>Google Drive access has been configured.</p>
          <p>You can close this window and return to the extension.</p>
          <p style="margin-top: 30px; color: #666;">Token saved. Audio files will now be uploaded to Google Drive.</p>
          <p style="margin-top: 20px; font-size: 12px; color: #999;">
            Token file: ${tokenSaved ? "✅ Found" : "❌ Not found"} at ${tokenPath}
          </p>
        </body>
      </html>
    `);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;
    
    logger.error("Error exchanging code for token", {
      error: errorMessage,
      stack: errorStack
    });
    
    res.status(500).send(`
      <html>
        <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
          <h1 style="color: #ea4335;">❌ Authorization Failed</h1>
          <p><strong>Error:</strong> ${errorMessage}</p>
          <p style="margin-top: 20px;">Common issues:</p>
          <ul style="text-align: left; display: inline-block; margin-top: 10px;">
            <li>Authorization code expired (codes expire quickly)</li>
            <li>Redirect URI mismatch in Google Cloud Console</li>
            <li>Invalid client credentials</li>
          </ul>
          <p style="margin-top: 30px;"><a href="/auth/google">Try again</a></p>
          <p style="margin-top: 10px;"><a href="/drive/status">Check status</a></p>
        </body>
      </html>
    `);
  }
});

// Check Google Drive status
app.get("/drive/status", (req: Request, res: Response) => {
  const configured = isDriveConfigured();
  const hasClientId = !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_ID !== "");
  const hasClientSecret = !!(process.env.GOOGLE_CLIENT_SECRET && process.env.GOOGLE_CLIENT_SECRET !== "");
  const hasFolderId = !!(process.env.GOOGLE_DRIVE_FOLDER_ID && process.env.GOOGLE_DRIVE_FOLDER_ID !== "");
  const tokenPath = path.join(__dirname, "token.json");
  const hasToken = fs.existsSync(tokenPath) || !!process.env.GOOGLE_REFRESH_TOKEN;
  
  // Determine the appropriate message
  let message = "";
  let nextStep = "";
  
  if (!hasClientId || !hasClientSecret) {
    message = "Google Drive credentials not configured";
    nextStep = "Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env file";
  } else if (!hasFolderId) {
    message = "Google Drive folder not configured";
    nextStep = "Set GOOGLE_DRIVE_FOLDER_ID in .env file";
  } else if (!hasToken) {
    message = "Google Drive credentials configured, but OAuth not completed";
    nextStep = "Visit /auth/google to get authorization URL, then complete OAuth flow";
  } else {
    message = "Google Drive is fully configured and ready";
    nextStep = "Audio files will be uploaded to Google Drive automatically";
  }
  
  res.json({
    configured,
    message,
    nextStep,
    details: {
      hasClientId,
      hasClientSecret,
      hasFolderId,
      hasToken,
      tokenFileExists: fs.existsSync(tokenPath),
      tokenFilePath: tokenPath,
      envFileLoaded: hasClientId || hasClientSecret
    }
  });
});

// Serve static files from downloads directory
app.use("/downloads", express.static(downloadsDir));

const PORT = 5000;
app.listen(PORT, () => {
  const driveConfigured = isDriveConfigured();
  
  logger.info(`Backend server started`, {
    port: PORT,
    environment: process.env.NODE_ENV || "development",
    timestamp: new Date().toISOString(),
    googleDriveConfigured: driveConfigured
  });

  if (!driveConfigured) {
    logger.warn("Google Drive is not configured. Audio files will be saved locally only.", {
      hint: "Set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_DRIVE_FOLDER_ID in .env file, then visit /auth/google"
    });
  } else {
    logger.info("Google Drive is configured and ready for uploads");
  }

  auditLog("SERVER_STARTED", {
    port: PORT,
    environment: process.env.NODE_ENV || "development",
    googleDriveConfigured: driveConfigured
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
