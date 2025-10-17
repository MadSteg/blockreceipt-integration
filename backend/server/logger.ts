/**
 * Logger for BlockReceipt.ai
 * 
 * This is a simple logger implementation to standardize logging throughout the application.
 */

// Log levels
enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3
}

// Current log level (can be configured via environment variable)
const currentLevel = process.env.LOG_LEVEL 
  ? (LogLevel[process.env.LOG_LEVEL.toUpperCase()] ?? LogLevel.INFO)
  : LogLevel.INFO;

/**
 * Logger class for standardized logging
 */
class Logger {
  private source: string;
  
  constructor(source: string = 'app') {
    this.source = source;
  }
  
  /**
   * Format log message with timestamp and source
   */
  private formatLog(level: string, message: string): string {
    const timestamp = new Date().toISOString();
    return `[${timestamp}] [${level}] [${this.source}] ${message}`;
  }
  
  /**
   * Log debug message
   */
  debug(message: string, ...args: any[]): void {
    if (currentLevel <= LogLevel.DEBUG) {
      console.debug(this.formatLog('DEBUG', message), ...args);
    }
  }
  
  /**
   * Log info message
   */
  info(message: string, ...args: any[]): void {
    if (currentLevel <= LogLevel.INFO) {
      console.info(this.formatLog('INFO', message), ...args);
    }
  }
  
  /**
   * Log warning message
   */
  warn(message: string, ...args: any[]): void {
    if (currentLevel <= LogLevel.WARN) {
      console.warn(this.formatLog('WARN', message), ...args);
    }
  }
  
  /**
   * Log error message
   */
  error(message: string, ...args: any[]): void {
    if (currentLevel <= LogLevel.ERROR) {
      console.error(this.formatLog('ERROR', message), ...args);
    }
  }
}

// Create and export default logger
const defaultLogger = new Logger();
export default defaultLogger;

// Export logger factory function
export function createLogger(source: string): Logger {
  return new Logger(source);
}