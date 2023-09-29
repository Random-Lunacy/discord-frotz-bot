class LoggerClass {
    /**
     * Logs the given message to the console.
     *
     * @param {string} message - The message to be logged.
     */
    log(message) {
        console.log(message);
    }

    /**
     * Logs a warning message to the console.
     *
     * @param {string} message - The warning message to be logged.
     */
    warn(message) {
        console.warn(message);
    }

    /**
     * Log an error message to the console.
     *
     * @param {string} message - The error message to log.
     */
    error(message) {
        console.error(message);
    }
}

export const Logger = new LoggerClass();
