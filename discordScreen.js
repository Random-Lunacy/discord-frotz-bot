import { BaseScreen, translateFont3Text } from 'rezrov-zmachine';

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
     * Hand everything printed since the last flush to the callback.
     */
    flush() {
        let text = this.buffer;
        this.buffer = '';

        // The game prints its own '>' prompt; the chat channel doesn't need it
        text = text.replace(/\s*>\s*$/, '').trim();

        if (text.length > 0) {
            this.onFlush(text, this.status);
        }
    }

    quit() {
        this.flush();
        this.onQuit?.();
    }
}
