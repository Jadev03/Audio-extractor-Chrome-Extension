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
import { writeMultipleToSheet, writeToSheet } from "./sheetsService.js";

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

    // Helper function to build base yt-dlp arguments
    const buildBaseArgs = (includeCookies: boolean = false) => {
      const browserForCookies = process.env.YT_DLP_BROWSER || "chrome";
      const baseArgs = [
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

    // Apply noise reduction to the main WAV file FIRST
    const enableNoiseReduction = process.env.ENABLE_NOISE_REDUCTION !== "false";
    if (enableNoiseReduction) {
      const denoisedWavPath = wavOutputPath.replace(/\.wav$/, "-denoised.wav");
      logger.info("Applying ML-based noise reduction to main audio file", { 
        requestId, 
        input: wavOutputPath, 
        output: denoisedWavPath 
      });
      
      try {
        await applyPythonNoiseReduction({
          pythonBin: process.env.PYTHON_BIN || "python",
          inputFile: wavOutputPath,
          outputFile: denoisedWavPath,
          method: process.env.NOISE_REDUCTION_METHOD || "spectral_gating",
          stationary: process.env.NOISE_REDUCTION_STATIONARY === "true",
          propDecrease: Number(process.env.NOISE_REDUCTION_PROP_DECREASE) || 0.8
        });

        // Replace original WAV with denoised version
        if (fs.existsSync(denoisedWavPath)) {
          fs.unlinkSync(wavOutputPath);
          fs.renameSync(denoisedWavPath, wavOutputPath);
          logger.info("Noise reduction completed on main audio file", { requestId, file: wavOutputPath });
        }
      } catch (noiseReductionError) {
        logger.warn("Noise reduction failed, continuing with original audio", {
          requestId,
          error: noiseReductionError instanceof Error ? noiseReductionError.message : String(noiseReductionError)
        });
        // Continue with original WAV if noise reduction fails
        if (fs.existsSync(denoisedWavPath)) {
          try {
            fs.unlinkSync(denoisedWavPath);
          } catch {
            // Ignore cleanup errors
          }
        }
      }
    }

    // Run VAD segmentation on the noise-reduced audio file
    // VAD parameters - using defaults that match vad_split.py, .env values will override
    const vadMinSilenceMs = Number(process.env.VAD_MIN_SILENCE_MS) || 650;
    const vadMinSpeechMs = Number(process.env.VAD_MIN_SPEECH_MS) || 900;
    const vadSentencePauseMs = Number(process.env.VAD_SENTENCE_PAUSE_MS) || 1100;
    const vadMaxSegmentSeconds = Number(process.env.VAD_MAX_SEGMENT_SECONDS) || 28;
    const vadSilenceThreshold = Number(process.env.VAD_SILENCE_THRESHOLD) || 0.004;

    logger.info("Running VAD segmentation", { 
      requestId, 
      wavOutputPath, 
      vadOutputDir,
      minSilenceMs: vadMinSilenceMs,
      minSpeechMs: vadMinSpeechMs,
      sentencePauseMs: vadSentencePauseMs,
      maxSegmentSeconds: vadMaxSegmentSeconds,
      silenceThreshold: vadSilenceThreshold
    });
    const segmentPrefix = `audio-${timestamp}`;
    const vadResult = await runSileroVad({
      pythonBin: process.env.PYTHON_BIN || "python",
      inputWav: wavOutputPath,
      outputDir: vadOutputDir,
      prefix: segmentPrefix,
      minSilenceMs: vadMinSilenceMs,
      minSpeechMs: vadMinSpeechMs,
      sentencePauseMs: vadSentencePauseMs,
      maxSegmentSeconds: vadMaxSegmentSeconds,
      silenceThreshold: vadSilenceThreshold
    });
    
    logger.info("VAD segmentation result", {
      requestId,
      segmentsCount: vadResult.segmentsCount,
      totalSpeechMs: vadResult.totalSpeechMs,
      segmentsDir: vadResult.segmentsDir,
      hasSegments: vadResult.segments && vadResult.segments.length > 0
    });

    const fileName = path.basename(wavOutputPath);
    // Note: wavOutputPath may not exist if already deleted, so get fileSize safely
    let fileSize = 0;
    try {
      if (fs.existsSync(wavOutputPath)) {
        fileSize = fs.statSync(wavOutputPath).size;
      }
    } catch {
      // File already deleted, that's fine
    }
    const duration = Date.now() - startTime;

    // Upload only segmented audios to Google Drive and Google Sheets
    let segmentUploadInfo = null;
    if (isDriveConfigured() && vadResult.segments && vadResult.segments.length > 0) {
      try {
        logger.info("Uploading segments to Google Drive", {
          requestId,
          segmentsCount: vadResult.segments.length,
          segmentsDir: vadResult.segmentsDir
        });

        // Prepare segments for upload (noise reduction already applied to main file before segmentation)
        logger.info("Preparing segments for upload", {
          requestId,
          segmentsCount: vadResult.segments.length,
          note: "Segments are already noise-reduced (applied to main file before segmentation)"
        });

        // Prepare segment files for upload (segments are already noise-reduced since main file was processed)
        const segmentFiles = vadResult.segments.map((seg: any) => ({
          filePath: seg.file,
          fileName: path.basename(seg.file)
        }));

        // Upload all processed segments to Google Drive
        const uploadedSegments = await uploadMultipleToDrive(segmentFiles);

        segmentUploadInfo = {
          uploadedCount: uploadedSegments.length,
          totalCount: vadResult.segments.length,
          segments: uploadedSegments.map((uploaded, idx) => {
            const originalSeg = vadResult.segments[idx] as any;
            return {
              ...uploaded,
              originalIndex: idx + 1,
              durationMs: originalSeg?.durationMs || (originalSeg?.end && originalSeg?.start ? (originalSeg.end - originalSeg.start) * 1000 : 0)
            };
          })
        };

        logger.info("Segments uploaded to Google Drive successfully", {
          requestId,
          uploadedCount: uploadedSegments.length,
          totalCount: vadResult.segments.length
        });

        // Write uploaded segment URLs to Google Sheet
        if (uploadedSegments.length > 0) {
          try {
            const sheetEntries = uploadedSegments.map((uploaded, idx) => {
              const originalSeg = vadResult.segments[idx] as any;
              const durationMs = originalSeg?.durationMs || 
                (originalSeg?.end && originalSeg?.start ? (originalSeg.end - originalSeg.start) * 1000 : 0);
              const time = durationMs > 0 ? `${(durationMs / 1000).toFixed(2)}s` : "";
              
              return {
                audioUrl: uploaded.webViewLink || "",
                time: time,
                text: "" // Always blank as per requirements
              };
            });

            await writeMultipleToSheet(sheetEntries);
            logger.info("Segment URLs written to Google Sheet", {
              requestId,
              count: sheetEntries.length
            });
          } catch (sheetError) {
            logger.error("Failed to write to Google Sheet", {
              requestId,
              error: sheetError instanceof Error ? sheetError.message : String(sheetError)
            });
            // Don't fail the entire request if sheet write fails
          }
        }

        // Delete the main unsegmented WAV file after successful upload
        // Keep only the segmented audio files locally
        try {
          if (fs.existsSync(wavOutputPath)) {
            await new Promise(resolve => setTimeout(resolve, 500)); // Wait for file handles to release
            fs.unlinkSync(wavOutputPath);
            logger.info("Main unsegmented WAV file deleted after upload", {
              requestId,
              file: wavOutputPath
            });
          }
        } catch (deleteErr) {
          logger.warn("Failed to delete main WAV file after upload", {
            requestId,
            file: wavOutputPath,
            error: deleteErr instanceof Error ? deleteErr.message : String(deleteErr)
          });
        }

        // Keep segmented audio files locally in downloads folder
        logger.info("Segmented audio files kept locally in downloads folder", {
          requestId,
          segmentsCount: vadResult.segments.length,
          segmentsDir: vadResult.segmentsDir
        });
      } catch (segmentUploadError) {
        logger.error("Failed to upload segments to Google Drive", {
          requestId,
          error: segmentUploadError instanceof Error ? segmentUploadError.message : String(segmentUploadError)
        });
        // Don't fail the entire request if segment upload fails
      }
    } else if (vadResult.segments && vadResult.segments.length === 0) {
      // No segments detected - log warning but don't upload anything
      logger.warn("No segments detected by VAD, nothing to upload", {
        requestId,
        segmentsCount: vadResult.segmentsCount,
        note: "Main WAV file already deleted, only segmented audios are uploaded"
      });
    }

    logger.info("Audio extraction successful", {
      requestId,
      youtubeUrl,
      fileName,
      fileSize: `${(fileSize / 1024 / 1024).toFixed(2)} MB`,
      duration: `${duration}ms`,
      segmentsCount: vadResult?.segmentsCount || 0
    });

    auditLog("EXTRACTION_SUCCESS", {
      requestId,
      youtubeUrl,
      fileName,
      fileSize,
      duration,
      segmentsCount: vadResult?.segmentsCount || 0,
      segmentsUploaded: segmentUploadInfo?.uploadedCount || 0,
      ip: req.ip || req.socket.remoteAddress
    });

    // Return response with segment information
    res.json({
      success: true,
      segmentsCount: vadResult?.segmentsCount || 0,
      vadSegments: vadResult?.segments || [],
      segmentsUploaded: segmentUploadInfo ? {
        uploadedCount: segmentUploadInfo.uploadedCount,
        totalCount: segmentUploadInfo.totalCount,
        segments: segmentUploadInfo.segments
      } : null,
      message: segmentUploadInfo 
        ? `${segmentUploadInfo.uploadedCount} segments uploaded to Google Drive`
        : "Segments created locally (Google Drive not configured)"
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
