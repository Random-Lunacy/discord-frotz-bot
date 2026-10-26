import { BaseInputProcessor } from '@random-lunacy/rezrov-zmachine';
import { isAnyKeyPrompt } from './screenText.js';

/**
 * Input processor for rezrov-zmachine. The game suspends when it asks for
 * input; `submit()` supplies a line of text and resumes it.
 */
export class DiscordInputProcessor extends BaseInputProcessor {
    /**
     * @param {DiscordScreen} screen - Screen whose output is flushed when input is wanted.
     * @param {object} prompts - Asks the player for a filename when the game saves or restores.
     * @param {function(): Promise<string>} prompts.save
     * @param {function(): Promise<string>} prompts.restore
     * @param {function(): void} [prompts.anyKey] - Called when the game pauses for any key.
     */
    constructor(screen, prompts) {
        super();
        this.screen = screen;
        this.prompts = prompts;
        this.machine = null;
        this.waiting = false;
        this.charMode = false;
        this.pendingFilename = null;

        // True while the game is paused on a "press any key" prompt
        this.anyKeyPending = false;

        // What a player typed at an "any key" prompt, to use as the game's next command
        this.queuedLine = null;
    }

    doStartTextInput() {
        this.waiting = true;
        this.charMode = false;
        this.anyKeyPending = false;
        this.screen.flush();

        if (this.queuedLine !== null) {
            const line = this.queuedLine;
            this.queuedLine = null;
            // Let the game finish suspending before it is resumed
            setTimeout(() => this.submit(line), 0);
        }
    }

    doStartCharInput() {
        this.waiting = true;
        this.charMode = true;
        this.screen.flush();

        this.anyKeyPending = isAnyKeyPrompt(this.screen.lastText);
        if (this.anyKeyPending) {
            this.prompts.anyKey?.();
        }
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
            let key = text.charAt(0) || '\r';

            // A pause takes any key. Anything the player typed is kept as their next command,
            // rather than being thrown away after its first letter.
            if (this.anyKeyPending) {
                key = '\r';
                if (text.trim().length > 1) {
                    this.queuedLine = text;
                }
            }
            this.anyKeyPending = false;
            this.onKeyPress(this.machine, key);
        } else {
            this.onInputComplete(this.machine, text, 13);
        }
        return true;
    }

    /**
     * Use this filename for the game's next save/restore prompt instead of asking the player.
     *
     * @param {string} path - Full path of the save file.
     */
    setNextFilename(path) {
        this.pendingFilename = path;
    }

    async promptForFilename(machine, operation) {
        if (this.pendingFilename) {
            const filename = this.pendingFilename;
            this.pendingFilename = null;
            return filename;
        }

        const filename = await (operation === 'save'
            ? this.prompts.save()
            : this.prompts.restore());

        // No filename means the bot cancelled it and has said so. The game will now print "Failed.",
        // which would only repeat that.
        if (!filename) {
            this.screen.suppressFailure = true;
        }
        return filename;
    }
}
