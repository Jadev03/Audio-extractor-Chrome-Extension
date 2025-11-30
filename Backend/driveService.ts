// Load environment variables if not already loaded (fallback)
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname } from "path";
import path from "path";
import fs from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Try to load .env file if not already loaded by server.ts
// Check multiple possible locations
const possibleEnvPaths = [
  path.join(__dirname, ".env"),           // Same directory (development)
  path.join(__dirname, "..", ".env"),     // Parent directory (production from dist)
  path.join(process.cwd(), ".env"),       // Current working directory
  path.join(process.cwd(), "Backend", ".env") // Backend subdirectory
];

for (const envPath of possibleEnvPaths) {
  if (fs.existsSync(envPath)) {
    const result = dotenv.config({ path: envPath });
    if (!result.error) {
      break; // Successfully loaded, stop trying
    }
  }
}

// Also try default dotenv.config() as fallback
if (!process.env.GOOGLE_CLIENT_ID) {
  dotenv.config();
}

import { google } from "googleapis";
import logger from "./logger.js";

// Google Drive API configuration
const CLIENT_ID = process.env.GOOGLE_CLIENT_ID || "";
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || "";
const REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI || "http://localhost:5000/oauth2callback";
const DRIVE_FOLDER_ID = process.env.GOOGLE_DRIVE_FOLDER_ID || "";

// Log configuration status (only in development to avoid logging secrets)
if (process.env.NODE_ENV !== "production") {
  logger.info("Google Drive configuration check", {
    hasClientId: !!CLIENT_ID,
    hasClientSecret: !!CLIENT_SECRET,
    hasRedirectUri: !!REDIRECT_URI,
    hasFolderId: !!DRIVE_FOLDER_ID,
    envFileLoaded: !!process.env.GOOGLE_CLIENT_ID
  });
}

// Token storage file path
// Try multiple locations to ensure we can save/load tokens correctly
const possibleTokenPaths = [
  path.join(__dirname, "token.json"),           // Same directory (development)
  path.join(__dirname, "..", "token.json"),     // Parent directory (production from dist)
  path.join(process.cwd(), "token.json"),        // Current working directory
  path.join(process.cwd(), "Backend", "token.json") // Backend subdirectory
];

// Use the first path that exists, or the first one if none exist (will create it)
let TOKEN_PATH = possibleTokenPaths[0];
for (const tokenPath of possibleTokenPaths) {
  const parentDir = path.dirname(tokenPath);
  if (fs.existsSync(parentDir)) {
    TOKEN_PATH = tokenPath;
    break;
  }
}

// Ensure parent directory exists
const tokenDir = path.dirname(TOKEN_PATH);
if (!fs.existsSync(tokenDir)) {
  fs.mkdirSync(tokenDir, { recursive: true });
}

interface TokenData {
  access_token?: string;
  refresh_token?: string;
  scope?: string;
  token_type?: string;
  expiry_date?: number;
}

/**
 * Load saved token from file
 */
function loadToken(): TokenData | null {
  try {
    if (fs.existsSync(TOKEN_PATH)) {
      const tokenData = fs.readFileSync(TOKEN_PATH, "utf8");
      return JSON.parse(tokenData);
    }
  } catch (error) {
    logger.error("Error loading token", { error: error instanceof Error ? error.message : String(error) });
  }
  return null;
}

/**
 * Save token to file
 */
export function saveToken(token: TokenData): void {
  try {
    // Ensure directory exists
    const tokenDir = path.dirname(TOKEN_PATH);
    if (!fs.existsSync(tokenDir)) {
      fs.mkdirSync(tokenDir, { recursive: true });
    }
    
    fs.writeFileSync(TOKEN_PATH, JSON.stringify(token, null, 2));
    logger.info("Token saved successfully", {
      tokenPath: TOKEN_PATH,
      hasRefreshToken: !!token.refresh_token,
      hasAccessToken: !!token.access_token,
      fileExists: fs.existsSync(TOKEN_PATH)
    });
  } catch (error) {
    logger.error("Error saving token", {
      error: error instanceof Error ? error.message : String(error),
      tokenPath: TOKEN_PATH,
      stack: error instanceof Error ? error.stack : undefined
    });
    throw error;
  }
}

/**
 * Get OAuth2 client
 */
export function getOAuth2Client() {
  return new google.auth.OAuth2(
    CLIENT_ID,
    CLIENT_SECRET,
    REDIRECT_URI
  );
}

/**
 * Get Google Drive client with automatic token refresh
 */
function getDriveClient() {
  const oauth2Client = getOAuth2Client();
  const token = loadToken();

  if (token) {
    oauth2Client.setCredentials(token);
    
    // Set up automatic token refresh
    oauth2Client.on("tokens", (tokens) => {
      if (tokens.refresh_token) {
        // Store the refresh token if provided
        token.refresh_token = tokens.refresh_token;
      }
      if (tokens.access_token) {
        token.access_token = tokens.access_token;
      }
      if (tokens.expiry_date) {
        token.expiry_date = tokens.expiry_date;
      }
      saveToken(token);
    });
  } else {
    // Try environment variable as fallback
    const envRefreshToken = process.env.GOOGLE_REFRESH_TOKEN;
    if (envRefreshToken) {
      oauth2Client.setCredentials({
        refresh_token: envRefreshToken
      });
    }
  }

  return google.drive({ version: "v3", auth: oauth2Client });
}

/**
 * Check if Google Drive credentials are configured
 */
export function isDriveConfigured(): boolean {
  const hasCredentials = !!(CLIENT_ID && CLIENT_SECRET && CLIENT_ID !== "" && CLIENT_SECRET !== "");
  const hasToken = loadToken() !== null || !!process.env.GOOGLE_REFRESH_TOKEN;
  return hasCredentials && hasToken;
}

/**
 * Get OAuth authorization URL for first-time setup
 */
export function getAuthUrl(): string {
  if (!CLIENT_ID || !CLIENT_SECRET) {
    const errorDetails = {
      hasClientId: !!CLIENT_ID,
      hasClientSecret: !!CLIENT_SECRET,
      envClientId: !!process.env.GOOGLE_CLIENT_ID,
      envClientSecret: !!process.env.GOOGLE_CLIENT_SECRET,
      __dirname: __dirname,
      cwd: process.cwd()
    };
    
    logger.error("Google Drive credentials not configured", errorDetails);
    
    throw new Error(
      "Google Drive credentials not configured. " +
      "Please ensure GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are set in .env file. " +
      "The .env file should be in the Backend directory. " +
      "After adding the variables, restart the server."
    );
  }

  const oauth2Client = getOAuth2Client();
  const scopes = [
    "https://www.googleapis.com/auth/drive.file"
  ];

  return oauth2Client.generateAuthUrl({
    access_type: "offline",
    scope: scopes,
    prompt: "consent" // Force consent to get refresh token
  });
}

/**
 * Exchange authorization code for tokens
 */
export async function getTokenFromCode(code: string): Promise<TokenData> {
  const oauth2Client = getOAuth2Client();
  const { tokens } = await oauth2Client.getToken(code);
  
  if (tokens) {
    // Convert Credentials to TokenData
    const tokenData: TokenData = {
      access_token: tokens.access_token || undefined,
      refresh_token: tokens.refresh_token || undefined,
      scope: tokens.scope || undefined,
      token_type: tokens.token_type || undefined,
      expiry_date: tokens.expiry_date || undefined
    };
    saveToken(tokenData);
    return tokenData;
  }
  
  throw new Error("Failed to get tokens from authorization code");
}

/**
 * Upload a file to Google Drive
 * @param filePath Local path to the file
 * @param fileName Name for the file in Drive
 * @returns Promise with file ID and web view link
 */
export async function uploadToDrive(
  filePath: string,
  fileName: string
): Promise<{ fileId: string; webViewLink: string; webContentLink: string }> {
  // Check if credentials are configured
  if (!isDriveConfigured()) {
    throw new Error(
      "Google Drive credentials not configured. " +
      "Please set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_REFRESH_TOKEN in .env file. " +
      "See GOOGLE_DRIVE_SETUP.md for setup instructions."
    );
  }

  try {
    const drive = getDriveClient();

    // Check if file exists locally
    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`);
    }

    const fileMetadata: any = {
      name: fileName,
    };

    // Add folder ID if specified
    if (DRIVE_FOLDER_ID) {
      fileMetadata.parents = [DRIVE_FOLDER_ID];
    }

    // Create read stream and ensure it's properly closed after upload
    const fileStream = fs.createReadStream(filePath);
    
    // Handle stream errors
    fileStream.on('error', (error) => {
      logger.error("File stream error during upload", {
        fileName,
        filePath,
        error: error.message
      });
    });
    
    const media = {
      mimeType: "audio/mpeg",
      body: fileStream,
    };

    logger.info("Uploading file to Google Drive", {
      fileName,
      filePath,
      folderId: DRIVE_FOLDER_ID || "root"
    });

    const response = await drive.files.create({
      requestBody: fileMetadata,
      media: media,
      fields: "id, name, webViewLink, webContentLink",
    });
    
    // Ensure stream is closed after upload completes
    if (!fileStream.destroyed) {
      fileStream.destroy();
    }

    if (!response.data.id) {
      throw new Error("Failed to upload file - no file ID returned");
    }

    // Make the file accessible (since folder is shared, file inherits permissions)
    // Optionally make file directly accessible
    try {
      await drive.permissions.create({
        fileId: response.data.id!,
        requestBody: {
          role: "reader",
          type: "anyone",
        },
      });
      logger.info("File permissions set to public read");
    } catch (permError) {
      // Permission setting is optional, log but don't fail
      logger.warn("Could not set file permissions", {
        error: permError instanceof Error ? permError.message : String(permError)
      });
    }

    logger.info("File uploaded successfully to Google Drive", {
      fileId: response.data.id,
      fileName: response.data.name,
      webViewLink: response.data.webViewLink
    });

    return {
      fileId: response.data.id!,
      webViewLink: response.data.webViewLink || "",
      webContentLink: response.data.webContentLink || ""
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    // Provide more specific error messages
    if (errorMessage.includes("invalid_grant") || errorMessage.includes("invalid_token")) {
      logger.error("Google Drive authentication failed - token may be expired or invalid", {
        error: errorMessage,
        fileName,
        filePath,
        hint: "Try re-authenticating at /auth/google"
      });
      throw new Error("Google Drive authentication failed. Please re-authenticate at /auth/google");
    }
    
    if (errorMessage.includes("insufficient permissions") || errorMessage.includes("permission denied")) {
      logger.error("Google Drive permission denied", {
        error: errorMessage,
        fileName,
        filePath,
        hint: "Check that the OAuth scopes include drive.file and the folder is accessible"
      });
      throw new Error("Permission denied. Please check Google Drive folder permissions and OAuth scopes.");
    }
    
    logger.error("Error uploading to Google Drive", {
      error: errorMessage,
      fileName,
      filePath,
      stack: error instanceof Error ? error.stack : undefined
    });
    throw error;
  }
}

/**
 * Delete a file from Google Drive
 * @param fileId Google Drive file ID
 */
export async function deleteFromDrive(fileId: string): Promise<void> {
  try {
    const drive = getDriveClient();
    await drive.files.delete({ fileId });
    logger.info("File deleted from Google Drive", { fileId });
  } catch (error) {
    logger.error("Error deleting from Google Drive", {
      error: error instanceof Error ? error.message : String(error),
      fileId
    });
    throw error;
  }
}

