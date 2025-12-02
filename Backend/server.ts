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

// Only load .env file if environment variables are not already set (Docker env_file takes precedence)
// Check if Docker has already set the env vars
const hasDockerEnv = process.env.GOOGLE_CLIENT_ID || process.env.GOOGLE_REDIRECT_URI;

if (!hasDockerEnv) {
  for (const envPath of possibleEnvPaths) {
    if (fs.existsSync(envPath)) {
      // Use override: false to not override existing env vars (from Docker)
      const result = dotenv.config({ path: envPath, override: false });
      if (!result.error) {
        envLoaded = true;
        loadedEnvPath = envPath;
        break;
      }
    }
  }

  // Also try default dotenv.config() as fallback (only if needed)
  if (!envLoaded) {
    dotenv.config({ override: false });
  }
} else {
  // Docker env vars are present, skip loading .env file
  envLoaded = true;
  loadedEnvPath = "Docker environment variables";
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
import { execSync, spawnSync } from "child_process";
import logger, { auditLog } from "./logger.js";
import { uploadToDrive, uploadToDriveWithUserToken, getAuthUrl, getTokenFromCode, isDriveConfigured } from "./driveService.js";
import { saveUserToken, loadUserToken, hasUserToken, getUserEmail } from "./userTokenService.js";

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
// In Docker, always prefer python -m yt_dlp as it's more reliable
// Check if yt-dlp is available, use python -m yt_dlp if needed
let usePythonModule = false;

// In Docker/container environments, prefer python module
const isDocker = fs.existsSync("/.dockerenv") || process.env.DOCKER_CONTAINER === "true";

if (isDocker) {
  // In Docker, always use python module
  try {
    execSync("python3 -m yt_dlp --version", { stdio: "ignore" });
    usePythonModule = true;
    logger.info("Docker detected: Using python3 -m yt_dlp for yt-dlp execution");
  } catch {
    try {
      execSync("python -m yt_dlp --version", { stdio: "ignore" });
      usePythonModule = true;
      logger.info("Docker detected: Using python -m yt_dlp for yt-dlp execution");
    } catch (err) {
      logger.error("yt-dlp not found in Docker. Please install: pip install yt-dlp");
    }
  }
} else {
  // On local machine, try python module first, then binary
  try {
    execSync("python3 -m yt_dlp --version", { stdio: "ignore" });
    usePythonModule = true;
    logger.info("Using python3 -m yt_dlp for yt-dlp execution");
  } catch {
    try {
      execSync("python -m yt_dlp --version", { stdio: "ignore" });
      usePythonModule = true;
      logger.info("Using python -m yt_dlp for yt-dlp execution");
    } catch {
      // Try yt-dlp binary directly
      try {
        execSync("yt-dlp --version", { stdio: "ignore" });
        logger.info("yt-dlp found in PATH (will use yt-dlp-wrap)");
      } catch (err) {
        logger.error("yt-dlp not found. Please install: pip install yt-dlp");
      }
    }
  }
}

// FFmpeg path configuration
// Try multiple methods to find FFmpeg:
// 1. Check if ffmpeg is in PATH (Docker/Linux)
// 2. Try ffmpeg-static package
// 3. Fall back to Windows hardcoded path
let ffmpegDir: string | null = null;
let ffmpegPath: string | null = null;

// Check if ffmpeg is in PATH (works in Docker/Linux)
try {
  execSync("ffmpeg -version", { stdio: "ignore" });
  ffmpegDir = ""; // Empty means use system PATH
  logger.info("FFmpeg found in system PATH");
} catch {
  // Try ffmpeg-static package
  try {
    const ffmpegStaticModule = require("ffmpeg-static");
    const ffmpegStaticPath = ffmpegStaticModule || ffmpegStaticModule.default || ffmpegStaticModule.path;
    
    if (ffmpegStaticPath && typeof ffmpegStaticPath === "string" && fs.existsSync(ffmpegStaticPath)) {
      ffmpegPath = ffmpegStaticPath;
      ffmpegDir = path.dirname(ffmpegPath);
      logger.info("FFmpeg found via ffmpeg-static package", { ffmpegPath });
    }
  } catch (err) {
    // Fall back to Windows hardcoded path
    const windowsFfmpegDir = "C:\\Users\\THABENDRA\\Desktop\\ffmpeg-2025-06-02-git-688f3944ce-full_build\\ffmpeg-build\\bin";
    const windowsFfmpegPath = path.join(windowsFfmpegDir, "ffmpeg.exe");
    
    if (fs.existsSync(windowsFfmpegPath)) {
      ffmpegDir = windowsFfmpegDir;
      ffmpegPath = windowsFfmpegPath;
      logger.info("FFmpeg found at Windows configured path", { ffmpegPath });
    } else {
      logger.warn("FFmpeg not found. Audio conversion may fail. Please install FFmpeg.", {
        triedPaths: ["system PATH", "ffmpeg-static", windowsFfmpegPath]
      });
    }
  }
}

const ytDlpWrap = new YTDlpWrap();

// Ensure downloads directory exists
const downloadsDir = path.join(__dirname, "downloads");
if (!fs.existsSync(downloadsDir)) {
  fs.mkdirSync(downloadsDir, { recursive: true });
}

/**
 * Clean YouTube URL by extracting video ID and removing playlist parameters
 * Handles various YouTube URL formats:
 * - https://www.youtube.com/watch?v=VIDEO_ID
 * - https://www.youtube.com/watch?v=VIDEO_ID&list=...
 * - https://youtu.be/VIDEO_ID
 * - https://youtu.be/VIDEO_ID?list=...
 */
function cleanYouTubeUrl(url: string): string {
  try {
    const urlObj = new URL(url);
    
    // Extract video ID from different URL formats
    let videoId: string | null = null;
    
    // Standard watch URL: ?v=VIDEO_ID
    if (urlObj.hostname.includes('youtube.com') && urlObj.pathname === '/watch') {
      videoId = urlObj.searchParams.get('v');
    }
    // Short URL: youtu.be/VIDEO_ID
    else if (urlObj.hostname.includes('youtu.be')) {
      videoId = urlObj.pathname.substring(1); // Remove leading /
    }
    // Embed URL: /embed/VIDEO_ID
    else if (urlObj.pathname.startsWith('/embed/')) {
      videoId = urlObj.pathname.substring(7); // Remove /embed/
    }
    
    if (!videoId) {
      logger.warn("Could not extract video ID from URL", { url });
      return url; // Return original if we can't parse it
    }
    
    // Reconstruct clean URL with just the video ID
    const cleanUrl = `https://www.youtube.com/watch?v=${videoId}`;
    logger.info("Cleaned YouTube URL", { original: url, cleaned: cleanUrl, videoId });
    return cleanUrl;
  } catch (error) {
    logger.warn("Error cleaning YouTube URL, using original", {
      url,
      error: error instanceof Error ? error.message : String(error)
    });
    return url; // Return original if parsing fails
  }
}

app.post("/extract", async (req: Request, res: Response) => {
  const { youtubeUrl, userId, userEmail } = req.body;
  const requestId = `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  logger.info("Audio extraction request received", {
    requestId,
    youtubeUrl: youtubeUrl || "missing",
    userId: userId || "missing",
    userEmail: userEmail || "missing",
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

  // Clean the YouTube URL to remove playlist parameters and other query params
  const cleanedUrl = cleanYouTubeUrl(youtubeUrl);
  
  const outputPath = path.join(downloadsDir, `audio-${Date.now()}.mp3`);
  const startTime = Date.now();

  try {
    logger.info("Starting audio extraction", {
      requestId,
      originalUrl: youtubeUrl,
      cleanedUrl,
      outputPath
    });

    // Use python -m yt_dlp if yt-dlp is not in PATH (preferred in Docker)
    if (usePythonModule) {
      // Execute using python -m yt_dlp with ffmpeg location and proper format selection
      // Use spawnSync to avoid shell parsing issues on Windows
      const pythonCmd = process.platform === "win32" ? "python" : "python3";
      const args: string[] = [
        "-m", "yt_dlp",
        cleanedUrl, // Use cleaned URL without playlist parameters
        "--no-playlist", // Only download single video, not entire playlist
        "--extract-audio", // Extract audio only
        "--audio-format", "mp3", // Convert to MP3
        "--audio-quality", "0", // Best quality
        "--format", "bestaudio/best", // Prefer best audio format
        "--postprocessor-args", "ffmpeg:-ac 2 -ar 44100", // Ensure stereo 44.1kHz
        "--output", outputPath,
        "--verbose" // Add verbose logging to see what's happening
      ];
      
      // Only add ffmpeg-location if ffmpegDir is specified (not empty/system PATH)
      if (ffmpegDir && ffmpegDir !== "") {
        args.splice(2, 0, "--ffmpeg-location", ffmpegDir);
      }
      
      logger.info("Executing yt-dlp with python module", {
        requestId,
        command: `${pythonCmd} ${args.join(" ")}`,
        outputPath
      });
      
      const result = spawnSync(pythonCmd, args, {
        stdio: "pipe", // Capture output for error messages
        shell: false,
        encoding: "utf8",
        timeout: 300000 // 5 minute timeout
      });
      
      // Log output for debugging
      if (result.stdout) {
        logger.info("yt-dlp stdout", {
          requestId,
          output: result.stdout.substring(0, 1000) // First 1000 chars
        });
      }
      if (result.stderr) {
        logger.warn("yt-dlp stderr", {
          requestId,
          error: result.stderr.substring(0, 1000) // First 1000 chars
        });
      }
      
      if (result.error) {
        logger.error("yt-dlp spawn error", {
          requestId,
          error: result.error.message,
          stack: result.error.stack
        });
        throw result.error;
      }
      
      if (result.status !== 0) {
        const errorOutput = result.stderr?.toString() || result.stdout?.toString() || "Unknown error";
        logger.error("yt-dlp execution failed", {
          requestId,
          exitCode: result.status,
          error: errorOutput.substring(0, 1000), // More error details
          stdout: result.stdout?.toString().substring(0, 500),
          stderr: result.stderr?.toString().substring(0, 500)
        });
        throw new Error(`yt-dlp process exited with code ${result.status}: ${errorOutput.substring(0, 300)}`);
      }
      
      logger.info("yt-dlp execution completed successfully", { requestId });
    } else {
      const ytDlpArgs = [
        cleanedUrl, // Use cleaned URL without playlist parameters
        "--no-playlist", // Only download single video, not entire playlist
        "--extract-audio", // Extract audio only
        "--audio-format", "mp3", // Convert to MP3
        "--audio-quality", "0", // Best quality
        "--format", "bestaudio/best", // Prefer best audio format
        "--postprocessor-args", "ffmpeg:-ac 2 -ar 44100", // Ensure stereo 44.1kHz
        "--output", outputPath
      ];
      
      // Only add ffmpeg-location if ffmpegDir is specified (not empty/system PATH)
      if (ffmpegDir && ffmpegDir !== "") {
        ytDlpArgs.splice(1, 0, "--ffmpeg-location", ffmpegDir);
      }
      
      // Set yt-dlp binary path if available (for yt-dlp-wrap)
      try {
        // Try 'which' (Linux/Mac) or 'where' (Windows)
        const whichCmd = process.platform === "win32" ? "where" : "which";
        const ytDlpPath = execSync(`${whichCmd} yt-dlp`, { encoding: "utf8", stdio: "pipe" }).trim().split("\n")[0];
        if (ytDlpPath && ytDlpPath.length > 0 && !ytDlpPath.includes("not found")) {
          ytDlpWrap.setBinaryPath(ytDlpPath);
          logger.info("yt-dlp binary path set for yt-dlp-wrap", { requestId, path: ytDlpPath });
        }
      } catch {
        // Binary path not found, yt-dlp-wrap will try to find it automatically
        logger.debug("Could not find yt-dlp binary path, yt-dlp-wrap will attempt auto-detection", { requestId });
      }
      
      logger.info("Executing yt-dlp with yt-dlp-wrap", {
        requestId,
        args: ytDlpArgs,
        outputPath
      });
      
      try {
        // yt-dlp-wrap.exec returns a promise, but we need to handle errors properly
        const result = await ytDlpWrap.exec(ytDlpArgs);
        logger.info("yt-dlp-wrap execution completed", { requestId, result: result ? "success" : "unknown" });
      } catch (ytDlpError) {
        const errorMsg = ytDlpError instanceof Error ? ytDlpError.message : String(ytDlpError);
        const errorStack = ytDlpError instanceof Error ? ytDlpError.stack : undefined;
        logger.error("yt-dlp-wrap execution failed", {
          requestId,
          error: errorMsg,
          stack: errorStack,
          args: ytDlpArgs
        });
        throw new Error(`yt-dlp failed: ${errorMsg}`);
      }
    }

    // Check if file was created
    // yt-dlp might create file with different name, so check downloads directory
    if (!fs.existsSync(outputPath)) {
      // Check if any .mp3 file was created recently in downloads directory
      const files = fs.readdirSync(downloadsDir);
      const recentMp3Files = files
        .filter(f => f.endsWith('.mp3'))
        .map(f => ({
          name: f,
          path: path.join(downloadsDir, f),
          mtime: fs.statSync(path.join(downloadsDir, f)).mtime.getTime()
        }))
        .filter(f => f.mtime > startTime - 5000) // Created within 5 seconds of request start
        .sort((a, b) => b.mtime - a.mtime); // Most recent first
      
      if (recentMp3Files.length > 0) {
        // Use the most recently created file
        const actualFile = recentMp3Files[0];
        logger.info("File created with different name than expected", {
          requestId,
          expected: path.basename(outputPath),
          actual: actualFile.name
        });
        // Update outputPath to the actual file
        const actualPath = actualFile.path;
        // Rename to expected name for consistency
        fs.renameSync(actualPath, outputPath);
      } else {
        logger.error("Audio file was not created", {
          requestId,
          outputPath,
          downloadsDirContents: files.slice(0, 10) // Show first 10 files for debugging
        });
        throw new Error("Audio file was not created. Check logs for yt-dlp errors.");
      }
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

    // Upload to Google Drive if user is authenticated
    let driveFileInfo = null;
    if (userId && hasUserToken(userId)) {
      try {
        const userToken = loadUserToken(userId);
        if (!userToken || !userToken.accessToken) {
          throw new Error("User token not found or invalid");
        }

        logger.info("Uploading to Google Drive with user token", { 
          requestId, 
          fileName,
          userId,
          userEmail: userToken.email
        });
        
        driveFileInfo = await uploadToDriveWithUserToken(
          outputPath, 
          fileName,
          userToken.accessToken
        );
        
        logger.info("File uploaded to Google Drive successfully", {
          requestId,
          fileId: driveFileInfo.fileId,
          webViewLink: driveFileInfo.webViewLink,
          uploadedBy: userToken.email
        });

        // Optionally delete local file after successful upload
        // Uncomment the following line if you want to delete local files after upload:
        // fs.unlinkSync(outputPath);
      } catch (driveError) {
        logger.error("Failed to upload to Google Drive, keeping local file", {
          requestId,
          userId,
          error: driveError instanceof Error ? driveError.message : String(driveError)
        });
        // Continue with local file URL if Drive upload fails
      }
    } else if (isDriveConfigured()) {
      // Fallback to shared token if no user token
      try {
        logger.info("Uploading to Google Drive with shared token", { requestId, fileName });
        driveFileInfo = await uploadToDrive(outputPath, fileName);
        
        logger.info("File uploaded to Google Drive successfully", {
          requestId,
          fileId: driveFileInfo.fileId,
          webViewLink: driveFileInfo.webViewLink
        });
      } catch (driveError) {
        logger.error("Failed to upload to Google Drive, keeping local file", {
          requestId,
          error: driveError instanceof Error ? driveError.message : String(driveError)
        });
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
      localFileUrl: driveFileInfo ? null : `http://localhost:5000/downloads/${fileName}`
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

// User authentication endpoint
app.post("/auth/user", async (req: Request, res: Response) => {
  const { userId, email, accessToken } = req.body;

  if (!userId || !email || !accessToken) {
    return res.status(400).json({
      success: false,
      error: "userId, email, and accessToken are required"
    });
  }

  try {
    saveUserToken(userId, email, accessToken);
    logger.info("User token saved", { userId, email });
    
    res.json({
      success: true,
      message: "User authentication saved successfully"
    });
  } catch (error) {
    logger.error("Error saving user token", {
      error: error instanceof Error ? error.message : String(error),
      userId
    });
    
    res.status(500).json({
      success: false,
      error: "Failed to save user authentication"
    });
  }
});

// Check user authentication status
app.get("/auth/user/:userId", (req: Request, res: Response) => {
  const { userId } = req.params;
  
  const hasToken = hasUserToken(userId);
  const email = getUserEmail(userId);
  
  res.json({
    authenticated: hasToken,
    email: email || null
  });
});

// Get latest authenticated user (for OAuth callback)
app.get("/auth/latest", (req: Request, res: Response) => {
  try {
    const tokensDir = path.join(__dirname, "..", "user-tokens");
    if (!fs.existsSync(tokensDir)) {
      return res.json({ userId: null, email: null });
    }
    
    // Get all token files, sorted by modification time (newest first)
    const files = fs.readdirSync(tokensDir)
      .filter(f => f.endsWith('.json'))
      .map(f => ({
        name: f,
        path: path.join(tokensDir, f),
        mtime: fs.statSync(path.join(tokensDir, f)).mtime.getTime()
      }))
      .sort((a, b) => b.mtime - a.mtime); // Newest first
    
    if (files.length === 0) {
      return res.json({ userId: null, email: null });
    }
    
    // Get the most recently modified token file
    const latestFile = files[0];
    const tokenData = JSON.parse(fs.readFileSync(latestFile.path, "utf8"));
    
    // Return the most recent user (check last 10 minutes to be safe)
    const tenMinutesAgo = Date.now() - (10 * 60 * 1000);
    if (latestFile.mtime > tenMinutesAgo) {
      logger.info("Returning latest authenticated user", {
        userId: tokenData.userId,
        email: tokenData.email,
        fileModified: new Date(latestFile.mtime).toISOString()
      });
      res.json({
        userId: tokenData.userId || null,
        email: tokenData.email || null
      });
    } else {
      logger.info("Latest user token is too old", {
        fileModified: new Date(latestFile.mtime).toISOString(),
        tenMinutesAgo: new Date(tenMinutesAgo).toISOString()
      });
      res.json({ userId: null, email: null });
    }
  } catch (error) {
    logger.error("Error getting latest authenticated user", {
      error: error instanceof Error ? error.message : String(error)
    });
    res.json({ userId: null, email: null });
  }
});

// Google Drive OAuth endpoints (for backward compatibility)
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
    
    // Get user info from Google using the access token
    let userEmail = "Unknown";
    let userId = "unknown";
    
    if (tokenData.access_token) {
      try {
        // Try the userinfo endpoint
        const userInfoResponse = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
          headers: {
            Authorization: `Bearer ${tokenData.access_token}`
          }
        });
        
        logger.info("User info API response", {
          status: userInfoResponse.status,
          statusText: userInfoResponse.statusText,
          ok: userInfoResponse.ok
        });
        
        if (userInfoResponse.ok) {
          const userData = await userInfoResponse.json() as { email?: string; id?: string; name?: string };
          userEmail = userData.email || "Unknown";
          userId = userData.id || "unknown";
          
          logger.info("User info retrieved successfully", { userId, email: userEmail, name: userData.name });
          
          // Save user token
          saveUserToken(userId, userEmail, tokenData.access_token, tokenData.refresh_token);
          logger.info("User token saved from OAuth callback", { userId, email: userEmail });
        } else {
          // Try to get error details
          const errorText = await userInfoResponse.text().catch(() => "Unknown error");
          logger.warn("Failed to get user info from API", {
            status: userInfoResponse.status,
            statusText: userInfoResponse.statusText,
            error: errorText.substring(0, 200)
          });
          
          // Try alternative: use Google Drive API to get user info
          try {
            const driveResponse = await fetch("https://www.googleapis.com/drive/v3/about?fields=user", {
              headers: {
                Authorization: `Bearer ${tokenData.access_token}`
              }
            });
            
            if (driveResponse.ok) {
              const driveData = await driveResponse.json() as { user?: { emailAddress?: string; displayName?: string; permissionId?: string } };
              if (driveData.user?.emailAddress) {
                userEmail = driveData.user.emailAddress;
                userId = driveData.user.permissionId || userEmail.split("@")[0] || "unknown";
                logger.info("User info retrieved from Drive API", { userId, email: userEmail });
                
                // Save user token
                saveUserToken(userId, userEmail, tokenData.access_token, tokenData.refresh_token);
                logger.info("User token saved from OAuth callback (via Drive API)", { userId, email: userEmail });
              }
            }
          } catch (driveError) {
            logger.warn("Failed to get user info from Drive API", {
              error: driveError instanceof Error ? driveError.message : String(driveError)
            });
          }
        }
      } catch (userInfoError) {
        logger.error("Error getting user info", {
          error: userInfoError instanceof Error ? userInfoError.message : String(userInfoError),
          stack: userInfoError instanceof Error ? userInfoError.stack : undefined
        });
      }
    }
    
    // Verify token was saved
    const tokenPath = path.join(__dirname, "token.json");
    const tokenSaved = fs.existsSync(tokenPath);
    
    logger.info("OAuth token saved successfully", {
      hasRefreshToken: !!tokenData.refresh_token,
      hasAccessToken: !!tokenData.access_token,
      tokenFileExists: tokenSaved,
      userId,
      userEmail
    });
    
    // Return success page with user info and JavaScript to notify extension
    res.send(`
      <html>
        <head>
          <title>Authorization Successful</title>
          <script>
            // Store user info in localStorage for extension to read
            localStorage.setItem('oauth_userId', '${userId}');
            localStorage.setItem('oauth_userEmail', '${userEmail}');
            localStorage.setItem('oauth_complete', 'true');
            
            // Try to close the window after a short delay
            setTimeout(() => {
              window.close();
            }, 2000);
          </script>
        </head>
        <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
          <h1 style="color: #34a853;">✅ Authorization Successful!</h1>
          <p>Logged in as: <strong>${userEmail}</strong></p>
          <p>Google Drive access has been configured.</p>
          <p style="margin-top: 20px;">You can close this window and return to the extension.</p>
          <p style="margin-top: 30px; color: #666;">Token saved. Audio files will now be uploaded to Google Drive with your account.</p>
          <p style="margin-top: 20px; font-size: 12px; color: #999;">
            This window will close automatically...
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
