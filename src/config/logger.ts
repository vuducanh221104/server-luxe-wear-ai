/**
 * @file logger.ts
 * @description Winston logger configuration
 */

import winston from "winston";
import DailyRotateFile from "winston-daily-rotate-file";
import path from "path";

// Define log levels
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

// Define log colors
const colors = {
  error: "red",
  warn: "yellow",
  info: "green",
  http: "magenta",
  debug: "white",
};

winston.addColors(colors);

// Define log format
const format = winston.format.combine(
  winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss:ms" }),
  winston.format.colorize({ all: true }),
  winston.format.printf((info) => `${info.timestamp} ${info.level}: ${info.message}`)
);

// Define JSON format for file logging
const jsonFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

// Define which transports to use
const transports = [
  // Console transport
  new winston.transports.Console({
    format: format,
  }),

  // Error log file transport
  new DailyRotateFile({
    filename: path.join("logs", "error-%DATE%.log"),
    datePattern: "YYYY-MM-DD",
    level: "error",
    format: jsonFormat,
    maxSize: "20m",
    maxFiles: "14d",
  }),

  // Combined log file transport
  new DailyRotateFile({
    filename: path.join("logs", "combined-%DATE%.log"),
    datePattern: "YYYY-MM-DD",
    format: jsonFormat,
    maxSize: "20m",
    maxFiles: "14d",
  }),
];

// Create the logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || "info",
  levels,
  transports,
  exitOnError: false,
});

// Create a stream object for Morgan
export const stream = {
  write: (message: string): void => {
    logger.http(message.trim());
  },
};

export default logger;
