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
import { uploadToDrive, getAuthUrl, getTokenFromCode, isDriveConfigured } from "./driveService.js";

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

// FFmpeg path configuration
const ffmpegDir = "D:\\ffmpeg\\bin";
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

  const timestamp = Date.now();
  const mp3OutputPath = path.join(downloadsDir, `audio-${timestamp}.mp3`);
  const wavOutputPath = path.join(downloadsDir, `audio-${timestamp}.wav`);
  const vadOutputDir = path.join(downloadsDir, `audio-${timestamp}-segments`);
  const startTime = Date.now();

  try {
    logger.info("Starting audio extraction", {
      requestId,
      youtubeUrl,
      outputPath: mp3OutputPath
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
        "--output", mp3OutputPath
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
        "--output", mp3OutputPath
      ]);
    }

    // Check if file was created
    if (!fs.existsSync(mp3OutputPath)) {
      throw new Error("Audio file was not created");
    }

    logger.info("Converting MP3 to WAV", { requestId, source: mp3OutputPath, target: wavOutputPath });
    await convertMp3ToWav({
      ffmpegPath,
      inputFile: mp3OutputPath,
      outputFile: wavOutputPath,
      sampleRate: 16000,
      channels: 1
    });

    // Delete MP3 after successful conversion to save space
    try {
      fs.unlinkSync(mp3OutputPath);
      logger.info("Source MP3 deleted after WAV conversion", { requestId, file: mp3OutputPath });
    } catch (deleteErr) {
      logger.warn("Failed to delete MP3 after WAV conversion", {
        requestId,
        file: mp3OutputPath,
        error: deleteErr instanceof Error ? deleteErr.message : String(deleteErr)
      });
    }

    logger.info("Running VAD segmentation", { requestId, wavOutputPath, vadOutputDir });
    const vadResult = await runSileroVad({
      pythonBin: process.env.PYTHON_BIN || "python",
      inputWav: wavOutputPath,
      outputDir: vadOutputDir,
      minSilenceMs: Number(process.env.VAD_MIN_SILENCE_MS) || 400,
      minSpeechMs: Number(process.env.VAD_MIN_SPEECH_MS) || 1200,
      sentencePauseMs: Number(process.env.VAD_SENTENCE_PAUSE_MS) || 800,
      maxSegmentSeconds: Number(process.env.VAD_MAX_SEGMENT_SECONDS) || 30
    });

    const fileName = path.basename(wavOutputPath);
    const fileSize = fs.statSync(wavOutputPath).size;
    const duration = Date.now() - startTime;

    logger.info("Audio extraction successful", {
      requestId,
      youtubeUrl,
      fileName,
      fileSize: `${(fileSize / 1024 / 1024).toFixed(2)} MB`,
      duration: `${duration}ms`
    });

    // Upload to Google Drive if configured
    let driveFileInfo = null;
    if (isDriveConfigured()) {
      try {
        logger.info("Uploading to Google Drive", { requestId, fileName });
        driveFileInfo = await uploadToDrive(wavOutputPath, fileName);
        
        logger.info("File uploaded to Google Drive successfully", {
          requestId,
          fileId: driveFileInfo.fileId,
          webViewLink: driveFileInfo.webViewLink
        });

        // Delete local file after successful upload to save disk space
        const deleteLocalFile = async (filePath: string, maxRetries = 3) => {
          for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
              // Wait a bit longer on Windows to ensure file handles are released
              await new Promise(resolve => setTimeout(resolve, attempt * 200));
              
              if (!fs.existsSync(filePath)) {
                logger.info("Local file already deleted", {
                  requestId,
                  fileName,
                  filePath,
                  attempt
                });
                return true;
              }
              
              const fileStats = fs.statSync(filePath);
              
              // Try to delete the file
              fs.unlinkSync(filePath);
              
              // Verify deletion
              await new Promise(resolve => setTimeout(resolve, 100));
              if (!fs.existsSync(filePath)) {
                logger.info("Local file deleted after successful Google Drive upload", {
                  requestId,
                  fileName,
                  filePath,
                  fileSize: `${(fileStats.size / 1024 / 1024).toFixed(2)} MB`,
                  attempt
                });
                return true;
              } else {
                logger.warn("File still exists after deletion attempt", {
                  requestId,
                  fileName,
                  filePath,
                  attempt,
                  maxRetries
                });
              }
            } catch (deleteError) {
              if (attempt === maxRetries) {
                throw deleteError;
              }
              logger.warn("Deletion attempt failed, retrying", {
                requestId,
                fileName,
                filePath,
                attempt,
                error: deleteError instanceof Error ? deleteError.message : String(deleteError)
              });
            }
          }
          return false;
        };
        
        try {
          const deleted = await deleteLocalFile(wavOutputPath);
          if (!deleted) {
            logger.error("Failed to delete local file after multiple attempts (file is in Drive)", {
              requestId,
              fileName,
              filePath: wavOutputPath
            });
          }
        } catch (deleteError) {
          // Log error but don't fail the request - file is already uploaded to Drive
          logger.error("Failed to delete local file after upload (file is in Drive)", {
            requestId,
            fileName,
            filePath: wavOutputPath,
            error: deleteError instanceof Error ? deleteError.message : String(deleteError),
            stack: deleteError instanceof Error ? deleteError.stack : undefined
          });
        }
      } catch (driveError) {
        logger.error("Failed to upload to Google Drive, keeping local file", {
          requestId,
          error: driveError instanceof Error ? driveError.message : String(driveError)
        });
        // Continue with local file URL if Drive upload fails
      }
    }

    auditLog("EXTRACTION_SUCCESS", {
      requestId,
      youtubeUrl,
      fileName,
      fileSize,
      duration,
      driveFileId: driveFileInfo?.fileId || null,
      ip: req.ip || req.socket.remoteAddress
    });

    // Return Google Drive link if available, otherwise local file URL
    res.json({
      success: true,
      fileUrl: driveFileInfo?.webViewLink || `http://localhost:5000/downloads/${fileName}`,
      driveFileId: driveFileInfo?.fileId || null,
      driveWebViewLink: driveFileInfo?.webViewLink || null,
      localFileUrl: driveFileInfo ? null : `http://localhost:5000/downloads/${fileName}`,
      wavFile: driveFileInfo ? driveFileInfo.webViewLink : `http://localhost:5000/downloads/${fileName}`,
      vadSegments: vadResult?.segments || [],
      vadSegmentsDir: vadResult?.segmentsDir || null
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

type VadParams = {
  pythonBin: string;
  inputWav: string;
  outputDir: string;
  minSilenceMs: number;
  minSpeechMs: number;
  sentencePauseMs: number;
  maxSegmentSeconds: number;
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
      "--min-silence",
      params.minSilenceMs.toString(),
      "--min-speech",
      params.minSpeechMs.toString(),
      "--sentence-pause",
      params.sentencePauseMs.toString(),
      "--max-segment-seconds",
      params.maxSegmentSeconds.toString()
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
