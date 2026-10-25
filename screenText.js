// Turning what a game draws on screen into text that reads well in a Discord message.
//
// Discord shows messages in a proportional font and collapses runs of spaces, so text a game
// lays out by position (a title block, a form, a quote with a right-aligned attribution) only
// keeps its shape inside a code block.

const FENCE = '```';
const MAX_BLOCK_LINES = 30;
const MAX_BLOCK_LENGTH = 1800;

// Text laid out by the game for a screen this wide, or narrower, is worth keeping aligned
const MAX_ALIGNED_WIDTH = 79;

/**
 * Put text in a code block. Fences inside the text are changed so they can't end the block early.
 *
 * @param {string} text - The text.
 * @return {string} The text in a code block.
 */
export function fence(text) {
    return `${FENCE}\n${text.replace(/```/g, '\'\'\'')}\n${FENCE}`;
}

/**
 * Tidy the rows of a window: drop trailing spaces and empty rows at the top and bottom, and take
 * off the indent every row has in common.
 *
 * @param {string[]} rows - The window's rows.
 * @return {string[]} The tidied rows (empty if the window is blank).
 */
export function trimRows(rows) {
    const trimmed = rows.map((row) => row.replace(/\s+$/, ''));
    while (trimmed.length && !trimmed[0]) {
        trimmed.shift();
    }
    while (trimmed.length && !trimmed[trimmed.length - 1]) {
        trimmed.pop();
    }

    const indent = Math.min(
        ...trimmed.filter(Boolean).map((row) => row.match(/^ */)[0].length)
    );
    return trimmed.map((row) => row.slice(indent));
}

/**
 * Describe the upper window of a V4+ game: one row is a status line, several rows are a block of
 * positioned text to show as it was laid out.
 *
 * @param {string[]} rows - The rows of the upper window that are on screen.
 * @return {{status: string|null, block: string|null}} At most one of the two is set.
 */
export function describeUpperWindow(rows) {
    const lines = trimRows(rows);
    const used = lines.filter(Boolean);

    if (used.length === 0) {
        return { status: null, block: null };
    }

    if (used.length === 1) {
        // "Location       Score: 36   Moves: 1" -> "Location · Score: 36 · Moves: 1"
        const status = used[0]
            .trim()
            .split(/\s{2,}/)
            .join(' · ')
            .replace(/: · /g, ': ');
        return { status, block: null };
    }

    let shown = lines.slice(0, MAX_BLOCK_LINES).join('\n');
    if (shown.length > MAX_BLOCK_LENGTH) {
        shown = shown.slice(0, MAX_BLOCK_LENGTH).replace(/\n[^\n]*$/, '');
    }
    return { status: null, block: fence(shown) };
}

/**
 * Whether a paragraph of the main window depends on its layout: short lines, some indented by
 * four or more spaces or with a wide gap in the middle.
 *
 * @param {string} paragraph - Lines of text with no blank line between them.
 * @return {boolean} True if the layout matters.
 */
export function isAligned(paragraph) {
    const lines = paragraph.split('\n');
    return (
        lines.every((line) => line.length <= MAX_ALIGNED_WIDTH) &&
        lines.some((line) => /^ {4,}\S/.test(line) || /\S {5,}\S/.test(line))
    );
}

/**
 * Put paragraphs whose layout matters in code blocks and leave the rest alone.
 *
 * @param {string} text - Text the game printed in its main window.
 * @return {string} The text, with aligned paragraphs in code blocks.
 */
export function fenceAlignedText(text) {
    // Splitting on a capture group keeps the blank lines between paragraphs
    return text
        .split(/(\n[ \t]*\n)/)
        .map((part, index) =>
            index % 2 === 0 && part.trim() && part.length <= MAX_BLOCK_LENGTH && isAligned(part)
                ? fence(part.replace(/^\n+/, ''))
                : part
        )
        .join('');
}

// "[Press any key to begin.]", "[Hit any key to continue.]", "Strike a key" ...
const PRESS_KEY = /\b(?:press|hit|strike|touch|tap)\b[^\n]{0,40}?\bkey\b/i;
// "[Press RETURN to continue.]", "[Continue]" ...
const BRACKETED_CONTINUE = /\[[^\]\n]*\b(?:continue|begin|proceed)\b[^\]\n]*\]/i;

/**
 * Whether the end of some output is a prompt to press any key. A game that wants a single key for
 * something else (a menu choice, yes or no) won't match.
 *
 * @param {string} text - What the game printed before asking for a key.
 * @return {boolean} True if the game is just pausing.
 */
export function isAnyKeyPrompt(text) {
    const lastLines = text.trimEnd().split('\n').slice(-2).join('\n');
    return PRESS_KEY.test(lastLines) || BRACKETED_CONTINUE.test(lastLines);
}

/**
 * Whether a game's output is just its "Failed." notice for a save or restore that did not happen.
 * Infocom games print "Failed."; some interpreters' games say "[Save failed]" or "Restore failed."
 *
 * @param {string} text - What the game printed.
 * @return {boolean} True if that is all it said.
 */
export function isFailureNotice(text) {
    return /^\[?\s*(?:(?:save|restore)\s+)?failed\.?\s*\]?$/i.test(text.trim());
}
