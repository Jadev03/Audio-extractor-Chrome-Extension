import { google } from "googleapis";
import fs from "fs";
import path from "path";
import logger from "./logger.js";

// Google Drive API configuration
// Replace these with your actual credentials from Google Cloud Console
// See GOOGLE_DRIVE_SETUP.md for detailed setup instructions
const CLIENT_ID = process.env.GOOGLE_CLIENT_ID || "";
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || "";
const REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI || "http://localhost:5000/oauth2callback";
const REFRESH_TOKEN = process.env.GOOGLE_REFRESH_TOKEN || "";

// Folder ID in Google Drive where files will be uploaded
// Leave empty to upload to root, or set a specific folder ID
const DRIVE_FOLDER_ID = process.env.GOOGLE_DRIVE_FOLDER_ID || "";

/**
 * Initialize Google Drive OAuth2 client
 */
function getDriveClient() {
  const oauth2Client = new google.auth.OAuth2(
    CLIENT_ID,
    CLIENT_SECRET,
    REDIRECT_URI
  );

  // Set credentials using refresh token
  oauth2Client.setCredentials({
    refresh_token: REFRESH_TOKEN
  });

  return google.drive({ version: "v3", auth: oauth2Client });
}

/**
 * Check if Google Drive credentials are configured
 */
function isDriveConfigured(): boolean {
  return !!(CLIENT_ID && CLIENT_SECRET && REFRESH_TOKEN && 
           CLIENT_ID !== "" && CLIENT_SECRET !== "" && REFRESH_TOKEN !== "");
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

    const media = {
      mimeType: "audio/mpeg",
      body: fs.createReadStream(filePath),
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

    if (!response.data.id) {
      throw new Error("Failed to upload file - no file ID returned");
    }

    // Make the file publicly accessible (optional - remove if you want private files)
    // Uncomment the following if you want public access:
    /*
    await drive.permissions.create({
      fileId: response.data.id,
      requestBody: {
        role: "reader",
        type: "anyone",
      },
    });
    */

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
    logger.error("Error uploading to Google Drive", {
      error: error instanceof Error ? error.message : String(error),
      fileName,
      filePath
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

