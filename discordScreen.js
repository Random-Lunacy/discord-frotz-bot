import { BaseScreen, translateFont3Text } from 'rezrov-zmachine';
import { describeUpperWindow, fenceAlignedText, isFailureNotice } from './screenText.js';

/**
 * Screen for rezrov-zmachine that collects game output as plain text.
 * Output is buffered until the game asks for input (or ends), then handed to
 * the `onFlush` callback as a single block of text.
 */
export class DiscordScreen extends BaseScreen {
    constructor(onFlush) {
        super('DiscordScreen', { startFromBottom: false });
        this.onFlush = onFlush;
        this.buffer = '';
        this.status = null;

        // What was last sent, so a status line or block is only sent again when it changes
        this.lastStatus = null;
        this.lastBlock = null;

        // What the game last printed before it stopped to wait, used to recognise "press any key"
        this.lastText = '';

        // Set when the bot cancelled a save or restore for the player (and said so itself), so the
        // game's own "Failed." that follows is dropped
        this.suppressFailure = false;
    }

    getCapabilities() {
        return {
            hasColors: false,
            hasBold: false,
            hasItalic: false,
            hasReverseVideo: false,
            hasFixedPitch: false,
            hasSplitWindow: true,
            hasDisplayStatusBar: true,
            hasPictures: false,
            hasSound: false,
            hasTimedKeyboardInput: false,
        };
    }

    getSize() {
        return { rows: 25, cols: 80 };
    }

    print(machine, str) {
        if (this.isMemoryStreamActive()) {
            this.writeToMemoryStream(machine, str);
            return;
        }

        if (!this.isScreenOutputEnabled()) {
            return;
        }

        const text = this.isCurrentFontFont3() ? translateFont3Text(str) : str;

        if (this.outputWindowId === 0) {
            this.buffer += text;
        } else {
            // The upper window is a fixed-position display that has no
            // equivalent in a chat channel, so keep the buffer only.
            this.writeToUpperWindowBuffer(text, this.getSize().cols);
        }
    }

    updateStatusBar(locationName, value1, value2, isTimeMode) {
        this.status = this.formatStatusBarLine(
            locationName,
            value1,
            value2,
            isTimeMode,
            this.getSize().cols
        )
            .replace(/\s{2,}/g, '  ')
            .trim();
    }

    /**
     * Hand everything printed since the last flush to the callback: the text, the status line
     * (when it has changed) and a block of positioned text from the upper window (when it has
     * changed).
     */
    flush() {
        let text = this.buffer;
        this.buffer = '';

        // The game prints its own '>' prompt (some print two); the chat channel doesn't need it.
        // Long runs of blank lines (used to space out a title) are shortened to one.
        text = text
            .replace(/\s*>+\s*$/, '')
            .replace(/(\n[ \t]*){3,}/g, '\n\n')
            .trim();
        text = fenceAlignedText(text);

        if (this.suppressFailure) {
            this.suppressFailure = false;
            if (isFailureNotice(text)) {
                text = '';
            }
        }
        this.lastText = text;

        // V1-V3 games set the status line directly; V4+ games draw it in the upper window
        const upper = describeUpperWindow(this.upperWindowBuffer.slice(0, this.upperWindowHeight));
        const statusLine = this.status ?? upper.status;

        const status = statusLine !== null && statusLine !== this.lastStatus ? statusLine : null;

        const block = upper.block !== null && upper.block !== this.lastBlock ? upper.block : null;
        this.lastBlock = upper.block;

        if (text.length > 0 || block !== null) {
            // Only remember a status line once it has been sent, so a message that is dropped
            // doesn't lose it
            if (statusLine !== null) {
                this.lastStatus = statusLine;
            }
            this.onFlush(text, status, block);
        }
    }

    quit() {
        this.flush();
        this.onQuit?.();
    }
}
