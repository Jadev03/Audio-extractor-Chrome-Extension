// Load environment variables if not already loaded (fallback)
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname } from "path";
import path from "path";
import fs from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Try to load .env file if not already loaded
const possibleEnvPaths = [
  path.join(__dirname, ".env"),
  path.join(__dirname, "..", ".env"),
  path.join(process.cwd(), ".env"),
  path.join(process.cwd(), "Backend", ".env")
];

for (const envPath of possibleEnvPaths) {
  if (fs.existsSync(envPath)) {
    const result = dotenv.config({ path: envPath });
    if (!result.error) {
      break;
    }
  }
}

if (!process.env.GOOGLE_CLIENT_ID) {
  dotenv.config();
}

import { google } from "googleapis";
import logger from "./logger.js";
import { getOAuth2Client } from "./driveService.js";

const __filename_sheets = fileURLToPath(import.meta.url);
const __dirname_sheets = dirname(__filename_sheets);

// Token path - same as driveService
const possibleTokenPaths = [
  path.join(__dirname_sheets, "token.json"),
  path.join(__dirname_sheets, "..", "token.json"),
  path.join(process.cwd(), "token.json"),
  path.join(process.cwd(), "Backend", "token.json")
];

let TOKEN_PATH_SHEETS = possibleTokenPaths[0];
for (const tokenPath of possibleTokenPaths) {
  const parentDir = path.dirname(tokenPath);
  if (fs.existsSync(parentDir)) {
    TOKEN_PATH_SHEETS = tokenPath;
    break;
  }
}

function loadTokenForSheets(): any {
  try {
    if (fs.existsSync(TOKEN_PATH_SHEETS)) {
      const tokenData = fs.readFileSync(TOKEN_PATH_SHEETS, "utf8");
      return JSON.parse(tokenData);
    }
  } catch (error) {
    logger.error("Error loading token for Sheets", { 
      error: error instanceof Error ? error.message : String(error) 
    });
  }
  return null;
}

// Google Sheets configuration
const SPREADSHEET_ID = "1o4yv-ET0dGA7ZEFpVOnV2oxZHM4vuDFYyZ6Y-zNW0Cc";
const USER_NUMBER = parseInt(process.env.USER_NUMBER || "1", 10);

// Determine which sheet to use based on user number
function getSheetName(): string {
  if (USER_NUMBER === 1) {
    return "Sheet1";
  } else if (USER_NUMBER === 2) {
    return "Sheet2";
  } else if (USER_NUMBER === 3) {
    return "Sheet3";
  } else {
    // Default to Sheet1 if user number is invalid
    logger.warn("Invalid USER_NUMBER, defaulting to Sheet1", { userNumber: USER_NUMBER });
    return "Sheet1";
  }
}

/**
 * Get Google Sheets client with automatic token refresh
 */
function getSheetsClient() {
  const oauth2Client = getOAuth2Client();
  const token = loadTokenForSheets();

  if (token) {
    oauth2Client.setCredentials(token);
    
    // Set up automatic token refresh
    oauth2Client.on("tokens", (tokens) => {
      if (tokens.refresh_token) {
        token.refresh_token = tokens.refresh_token;
      }
      if (tokens.access_token) {
        token.access_token = tokens.access_token;
      }
      if (tokens.expiry_date) {
        token.expiry_date = tokens.expiry_date;
      }
      // Save token back to file
      try {
        const tokenDir = path.dirname(TOKEN_PATH_SHEETS);
        if (!fs.existsSync(tokenDir)) {
          fs.mkdirSync(tokenDir, { recursive: true });
        }
        fs.writeFileSync(TOKEN_PATH_SHEETS, JSON.stringify(token, null, 2));
      } catch (error) {
        logger.error("Error saving token for Sheets", {
          error: error instanceof Error ? error.message : String(error)
        });
      }
    });
  } else {
    // Try environment variable as fallback
    const envRefreshToken = process.env.GOOGLE_REFRESH_TOKEN;
    if (envRefreshToken) {
      oauth2Client.setCredentials({
        refresh_token: envRefreshToken
      });
    } else {
      logger.warn("No token found for Google Sheets authentication", {
        tokenPath: TOKEN_PATH_SHEETS,
        tokenExists: fs.existsSync(TOKEN_PATH_SHEETS)
      });
    }
  }

  return google.sheets({ version: "v4", auth: oauth2Client });
}

/**
 * Get current Sri Lankan date and time in DD/MM/YYYY HH:MM format
 * Sri Lanka uses SLST (Sri Lanka Standard Time) which is UTC+5:30
 */
function getCurrentSriLankanDateTime(): string {
  const now = new Date();
  
  // Get UTC time components
  const utcYear = now.getUTCFullYear();
  const utcMonth = now.getUTCMonth();
  const utcDate = now.getUTCDate();
  const utcHours = now.getUTCHours();
  const utcMinutes = now.getUTCMinutes();
  
  // Add 5 hours and 30 minutes for Sri Lankan time (UTC+5:30)
  let sriLankanHours = utcHours + 5;
  let sriLankanMinutes = utcMinutes + 30;
  let sriLankanDate = utcDate;
  let sriLankanMonth = utcMonth;
  let sriLankanYear = utcYear;
  
  // Handle minute overflow (if minutes >= 60)
  if (sriLankanMinutes >= 60) {
    sriLankanHours += 1;
    sriLankanMinutes -= 60;
  }
  
  // Handle hour overflow (if hours >= 24)
  if (sriLankanHours >= 24) {
    sriLankanHours -= 24;
    sriLankanDate += 1;
  }
  
  // Handle date overflow (need to check days in month)
  // Use Sri Lankan month/year for accurate calculation
  const daysInMonth = new Date(sriLankanYear, sriLankanMonth + 1, 0).getDate();
  if (sriLankanDate > daysInMonth) {
    sriLankanDate = 1;
    sriLankanMonth += 1;
    
    // Handle month overflow (if month >= 12)
    if (sriLankanMonth >= 12) {
      sriLankanMonth = 0;
      sriLankanYear += 1;
    }
  }
  
  // Format: DD/MM/YYYY HH:MM
  const day = sriLankanDate.toString().padStart(2, "0");
  const month = (sriLankanMonth + 1).toString().padStart(2, "0"); // Month is 0-indexed
  const year = sriLankanYear.toString();
  const hours = sriLankanHours.toString().padStart(2, "0");
  const minutes = sriLankanMinutes.toString().padStart(2, "0");
  
  return `${day}/${month}/${year} ${hours}:${minutes}`;
}

/**
 * Write audio URL to Google Sheet
 * @param audioUrl The URL of the uploaded audio file
 * @param time Optional duration time value (can be empty string)
 * @param text Optional text value (should be blank as per requirements)
 * @returns Promise<void>
 */
export async function writeToSheet(
  audioUrl: string,
  time: string = "",
  text: string = ""
): Promise<void> {
  try {
    const sheets = getSheetsClient();
    const sheetName = getSheetName();

    logger.info("Writing to Google Sheet", {
      spreadsheetId: SPREADSHEET_ID,
      sheetName,
      userNumber: USER_NUMBER,
      audioUrl: audioUrl.substring(0, 50) + "..."
    });

    // Get the current data to find the next empty row
    const range = `${sheetName}!A:D`;
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: range
    });

    const rows = response.data.values || [];
    // Find the next empty row (after header row if exists)
    let nextRow = rows.length + 1;
    
    // If first row exists and looks like a header, start from row 2
    if (rows.length > 0 && rows[0] && rows[0].length > 0) {
      const firstRow = rows[0];
      // Check if first row contains header-like text
      if (firstRow[0] && typeof firstRow[0] === "string" && 
          (firstRow[0].toLowerCase().includes("audio") || 
           firstRow[0].toLowerCase().includes("link"))) {
        nextRow = rows.length + 1;
      } else {
        nextRow = rows.length + 1;
      }
    }

    // Get current Sri Lankan date and time
    const uploadDateTime = getCurrentSriLankanDateTime();

    // Prepare the row data: [audioUrl, durationTime, uploadDateTime, text]
    const values = [[audioUrl, time, uploadDateTime, text]];

    // Append the row to the sheet
    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: `${sheetName}!A${nextRow}:D${nextRow}`,
      valueInputOption: "USER_ENTERED",
      requestBody: {
        values: values
      }
    });

    logger.info("Successfully wrote to Google Sheet", {
      spreadsheetId: SPREADSHEET_ID,
      sheetName,
      row: nextRow,
      userNumber: USER_NUMBER
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error("Error writing to Google Sheet", {
      error: errorMessage,
      spreadsheetId: SPREADSHEET_ID,
      sheetName: getSheetName(),
      userNumber: USER_NUMBER,
      stack: error instanceof Error ? error.stack : undefined
    });
    // Don't throw error - we don't want to fail the upload if sheet write fails
    // Just log it
  }
}

/**
 * Write multiple audio URLs to Google Sheet
 * @param entries Array of objects with audioUrl, time (optional), and text (optional)
 * @returns Promise<void>
 */
export async function writeMultipleToSheet(
  entries: Array<{ audioUrl: string; time?: string; text?: string }>
): Promise<void> {
  try {
    const sheets = getSheetsClient();
    const sheetName = getSheetName();

    logger.info("Writing multiple entries to Google Sheet", {
      spreadsheetId: SPREADSHEET_ID,
      sheetName,
      userNumber: USER_NUMBER,
      count: entries.length
    });

    // Get the current data to find the next empty row
    const range = `${sheetName}!A:D`;
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: range
    });

    const rows = response.data.values || [];
    let nextRow = rows.length + 1;
    
    // If first row exists and looks like a header, start from row 2
    if (rows.length > 0 && rows[0] && rows[0].length > 0) {
      const firstRow = rows[0];
      if (firstRow[0] && typeof firstRow[0] === "string" && 
          (firstRow[0].toLowerCase().includes("audio") || 
           firstRow[0].toLowerCase().includes("link"))) {
        nextRow = rows.length + 1;
      } else {
        nextRow = rows.length + 1;
      }
    }

    // Get current Sri Lankan date and time (same for all entries in this batch)
    const uploadDateTime = getCurrentSriLankanDateTime();

    // Prepare the rows data: [audioUrl, durationTime, uploadDateTime, text]
    const values = entries.map(entry => [
      entry.audioUrl,
      entry.time || "",
      uploadDateTime,
      entry.text || ""
    ]);

    // Append the rows to the sheet
    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: `${sheetName}!A${nextRow}:D${nextRow + values.length - 1}`,
      valueInputOption: "USER_ENTERED",
      requestBody: {
        values: values
      }
    });

    logger.info("Successfully wrote multiple entries to Google Sheet", {
      spreadsheetId: SPREADSHEET_ID,
      sheetName,
      startRow: nextRow,
      count: entries.length,
      userNumber: USER_NUMBER
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error("Error writing multiple entries to Google Sheet", {
      error: errorMessage,
      spreadsheetId: SPREADSHEET_ID,
      sheetName: getSheetName(),
      userNumber: USER_NUMBER,
      count: entries.length,
      stack: error instanceof Error ? error.stack : undefined
    });
    // Don't throw error - we don't want to fail the upload if sheet write fails
  }
}


