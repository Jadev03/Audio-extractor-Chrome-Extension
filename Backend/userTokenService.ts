// Per-user token storage service
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";
import logger from "./logger.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Directory to store user tokens
const tokensDir = path.join(__dirname, "..", "user-tokens");
if (!fs.existsSync(tokensDir)) {
  fs.mkdirSync(tokensDir, { recursive: true });
}

interface UserTokenData {
  userId: string;
  email: string;
  accessToken: string;
  refreshToken?: string;
  expiryDate?: number;
  createdAt: number;
}

/**
 * Get token file path for a user
 */
function getUserTokenPath(userId: string): string {
  // Sanitize userId to use as filename
  const safeUserId = userId.replace(/[^a-zA-Z0-9]/g, "_");
  return path.join(tokensDir, `${safeUserId}.json`);
}

/**
 * Save user token
 */
export function saveUserToken(userId: string, email: string, accessToken: string, refreshToken?: string): void {
  try {
    const tokenData: UserTokenData = {
      userId,
      email,
      accessToken,
      refreshToken,
      createdAt: Date.now()
    };

    const tokenPath = getUserTokenPath(userId);
    fs.writeFileSync(tokenPath, JSON.stringify(tokenData, null, 2));
    
    logger.info("User token saved", {
      userId,
      email,
      tokenPath
    });
  } catch (error) {
    logger.error("Error saving user token", {
      error: error instanceof Error ? error.message : String(error),
      userId
    });
    throw error;
  }
}

/**
 * Load user token
 */
export function loadUserToken(userId: string): UserTokenData | null {
  try {
    const tokenPath = getUserTokenPath(userId);
    if (fs.existsSync(tokenPath)) {
      const tokenData = fs.readFileSync(tokenPath, "utf8");
      return JSON.parse(tokenData);
    }
  } catch (error) {
    logger.error("Error loading user token", {
      error: error instanceof Error ? error.message : String(error),
      userId
    });
  }
  return null;
}

/**
 * Check if user has a valid token
 */
export function hasUserToken(userId: string): boolean {
  const token = loadUserToken(userId);
  return token !== null && !!token.accessToken;
}

/**
 * Get user email from stored token
 */
export function getUserEmail(userId: string): string | null {
  const token = loadUserToken(userId);
  return token?.email || null;
}

