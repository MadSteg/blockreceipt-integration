/**
 * Simple logger for the BlockReceipt application
 */

enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3
}

// Configure logging level from environment or default to INFO
const currentLogLevel = process.env.LOG_LEVEL 
  ? (LogLevel[process.env.LOG_LEVEL as keyof typeof LogLevel] || LogLevel.INFO) 
  : LogLevel.INFO;

// Format timestamp for logs
const getTimestamp = () => {
  return new Date().toISOString();
};

// Log formatter
const formatLog = (level: string, message: string, meta?: any) => {
  const timestamp = getTimestamp();
  const metaStr = meta ? ` ${JSON.stringify(meta)}` : '';
  return `[${timestamp}] [${level}] ${message}${metaStr}`;
};

export const createLogger = (context: string) => {
  // Return a logger specific to a component or context
  return {
    debug: (message: string, meta?: any) => {
      if (currentLogLevel >= LogLevel.DEBUG) {
        console.debug(formatLog('DEBUG', `[${context}] ${message}`, meta));
      }
    },
    
    info: (message: string, meta?: any) => {
      if (currentLogLevel >= LogLevel.INFO) {
        console.info(formatLog('INFO', `[${context}] ${message}`, meta));
      }
    },
    
    warn: (message: string, meta?: any) => {
      if (currentLogLevel >= LogLevel.WARN) {
        console.warn(formatLog('WARN', `[${context}] ${message}`, meta));
      }
    },
    
    error: (message: string, meta?: any) => {
      if (currentLogLevel >= LogLevel.ERROR) {
        console.error(formatLog('ERROR', `[${context}] ${message}`, meta));
      }
    }
  };
};

// Default logger with no context
export const logger = {
  debug: (message: string, meta?: any) => {
    if (currentLogLevel >= LogLevel.DEBUG) {
      console.debug(formatLog('DEBUG', message, meta));
    }
  },
  
  info: (message: string, meta?: any) => {
    if (currentLogLevel >= LogLevel.INFO) {
      console.info(formatLog('INFO', message, meta));
    }
  },
  
  warn: (message: string, meta?: any) => {
    if (currentLogLevel >= LogLevel.WARN) {
      console.warn(formatLog('WARN', message, meta));
    }
  },
  
  error: (message: string, meta?: any) => {
    if (currentLogLevel >= LogLevel.ERROR) {
      console.error(formatLog('ERROR', message, meta));
    }
  }
};