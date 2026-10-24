import { BaseInputProcessor } from 'rezrov-zmachine';

/**
 * Input processor for rezrov-zmachine. The game suspends when it asks for
 * input; `submit()` supplies a line of text and resumes it.
 */
export class DiscordInputProcessor extends BaseInputProcessor {
    constructor(screen) {
        super();
        this.screen = screen;
        this.machine = null;
        this.waiting = false;
        this.charMode = false;
        this.pendingFilename = null;
    }

    doStartTextInput() {
        this.waiting = true;
        this.charMode = false;
        this.screen.flush();
    }

    doStartCharInput() {
        this.waiting = true;
        this.charMode = true;
        this.screen.flush();
    }

    /**
     * Provide a line of input to a waiting game.
     *
     * @param {string} text - The line to send.
     * @return {boolean} False if the game was not waiting for input.
     */
    submit(text) {
        if (!this.waiting) {
            return false;
        }
        this.waiting = false;

        if (this.charMode) {
            this.onKeyPress(this.machine, text.charAt(0) || '\r');
        } else {
            this.onInputComplete(this.machine, text, 13);
        }
        return true;
    }

    /**
     * Queue the filename the game's next save/restore prompt will receive.
     *
     * @param {string} path - Full path of the save file.
     */
    setNextFilename(path) {
        this.pendingFilename = path;
    }

    async promptForFilename() {
        const filename = this.pendingFilename;
        this.pendingFilename = null;
        return filename ?? '';
    }
}
