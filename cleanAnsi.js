/**
 * The default escape code replacement map used by `replaceAnsiCodes`
 */
const replaceCodeList = {
    // Color codes
    '\x1B[30m': '',         // Black
    '\x1B[31m': '',         // Red
    '\x1B[32m': '',         // Green
    '\x1B[33m': '',         // Yellow
    '\x1B[34m': '',         // [blue
    '\x1B[35m': '',         // Magenta
    '\x1B[36m': '',         // Cyan
    '\x1B[37m': '',         // White

    '\x1B[30;1m': '',       // Bright Black
    '\x1B[31;1m': '',       // Bright Red
    '\x1B[32;1m': '',       // Bright Green
    '\x1B[33;1m': '',       // Bright Yellow
    '\x1B[34;1m': '',       // Bright Blue
    '\x1B[35;1m': '',       // Bright Magenta
    '\x1B[36;1m': '',       // Bright Cyan
    '\x1B[37;1m': '',       // Bright White

    '\x1B[40m': '',         // Background Black
    '\x1B[41m': '',         // Background Red
    '\x1B[42m': '',         // Background Green
    '\x1B[43m': '',         // Background Yellow
    '\x1B[44m': '',         // Background Blue
    '\x1B[45m': '',         // Background Magenta
    '\x1B[46m': '',         // Background Cyan
    '\x1B[47m': '',         // Background White

    '\x1B[39m': '',         // Reset color
    '\x1B[49m': '',         // Reset background color

    // Clear codes
    '\x1B[0K': '',          // Clear to end of line

    // Text formatting codes
    '\x1B[1m': '**',        // Bold
    '\x1B[22m': '**',       // Reset Bold
    '\x1B[4m': '*',         // Underline
    '\x1B[24m': '*',        // Reset Underline
    '\x1B[7m': '[rev]',     // Reversed     
    '\x1B[27m': '',         // Positive (not inverse)

    '\x1B[0m': '[reset]',
    '\x1B[m': '[reset-short]',
};

class CleanAnsiClass {
    escapeRegex(str) {
        return str.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    }

    /**
     * Replace ANSI escape codes in `str` with replacements in replaceCodeList,
     *
     * @param {string} str The string to replace stuff in.
     * @returns {string} The string with replacements applied.
     */
    replace(str) {
        let out = str;

        for (const [key, value] of Object.entries(replaceCodeList)) {
            out = out.replace(new RegExp(this.escapeRegex(key), 'g'), value);
        }

        return out;
    }
}
export const CleanAnsi = new CleanAnsiClass();
