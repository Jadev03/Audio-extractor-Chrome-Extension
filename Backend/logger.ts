import winston from "winston";
import DailyRotateFile from "winston-daily-rotate-file";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { dirname } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Ensure logs directory exists
const logsDir = path.join(__dirname, "logs");
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Custom log format
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json()
);

// Console format for development
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    let msg = `${timestamp} [${level}]: ${message}`;
    if (Object.keys(meta).length > 0) {
      msg += ` ${JSON.stringify(meta)}`;
    }
    return msg;
  })
);

// Create daily rotate file transport for all logs
const allLogsTransport = new DailyRotateFile({
  filename: path.join(logsDir, "application-%DATE%.log"),
  datePattern: "YYYY-MM-DD",
  maxSize: "20m",
  maxFiles: "14d", // Keep logs for 14 days
  format: logFormat,
  level: "info"
});

// Create daily rotate file transport for error logs
const errorLogsTransport = new DailyRotateFile({
  filename: path.join(logsDir, "error-%DATE%.log"),
  datePattern: "YYYY-MM-DD",
  maxSize: "20m",
  maxFiles: "30d", // Keep error logs for 30 days
  format: logFormat,
  level: "error"
});

// Create daily rotate file transport for audit logs
const auditLogsTransport = new DailyRotateFile({
  filename: path.join(logsDir, "audit-%DATE%.log"),
  datePattern: "YYYY-MM-DD",
  maxSize: "20m",
  maxFiles: "90d", // Keep audit logs for 90 days
  format: logFormat,
  level: "info"
});

// Create the logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || "info",
  format: logFormat,
  defaultMeta: { service: "audio-extractor-backend" },
  transports: [
    allLogsTransport,
    errorLogsTransport,
    auditLogsTransport
  ],
  exceptionHandlers: [
    new DailyRotateFile({
      filename: path.join(logsDir, "exceptions-%DATE%.log"),
      datePattern: "YYYY-MM-DD",
      maxSize: "20m",
      maxFiles: "30d"
    })
  ],
  rejectionHandlers: [
    new DailyRotateFile({
      filename: path.join(logsDir, "rejections-%DATE%.log"),
      datePattern: "YYYY-MM-DD",
      maxSize: "20m",
      maxFiles: "30d"
    })
  ]
});

// Create a separate audit logger that only writes to audit log file
const auditLogger = winston.createLogger({
  level: "info",
  format: logFormat,
  defaultMeta: { service: "audio-extractor-backend", logType: "audit" },
  transports: [auditLogsTransport]
});

// Add console transport in development or when LOG_CONSOLE is enabled
// This helps with Docker visibility
if (process.env.NODE_ENV !== "production" || process.env.LOG_CONSOLE === "true") {
  logger.add(
    new winston.transports.Console({
      format: consoleFormat
    })
  );
}

// Helper function for audit logging
export const auditLog = (action: string, details: Record<string, any>) => {
  const auditEntry = {
    action,
    ...details,
    timestamp: new Date().toISOString()
  };
  
  // Log to main logger
  logger.info("AUDIT", auditEntry);
  
  // Also log to dedicated audit logger
  auditLogger.info("AUDIT", auditEntry);
};

export default logger;

