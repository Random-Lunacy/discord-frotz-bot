import { sharedData } from './sharedData.js';
import {} from 'dotenv/config';
import { Logger } from './logger.js';
import { StringDecoder } from 'string_decoder';
import { spawn } from 'child_process';
import fs from 'fs';
import { CleanAnsi } from './cleanAnsi.js';

class FrotzClient {
    dFrotz = null;
    rawOutput = '';
    compiledOutput = '';
    gamePath = '';
    gameHeader = '';

    lastError = null;
    decoder = new StringDecoder('utf8');

    /**
     * Verifies if the game file exists at the given file path.
     *
     * @param {string} filePath - The path to the game file.
     * @return {boolean} Returns true if the game file exists, otherwise false.
     */
    verifyGameFile(filePath) {
        return fs.existsSync(filePath);
    }

    /**
     * Starts the game specified by the given game file.
     *
     * @param {string} gameFile - The name of the game file.
     * @return {boolean} Returns false if the game file does not exist, otherwise returns true.
     */
    startGame(gameFile) {
        this.gamePath = sharedData.gameFolder + '/' + gameFile;

        if (!this.verifyGameFile(this.gamePath)) {
            Logger.log({
                level: 'warn',
                message: `Failed to launch Frotz: the game file ${gameFile} does not exist.`,
            });
            this.lastError = new Error(
                `Failed to launch Frotz: the game file ${gameFile} does not exist.`
            );
            return false;
        }

        Logger.log({
            level: 'info',
            message: `Launching Frotz: ${this.gamePath}`,
        });

        // Create dFrotz child process for the game
        // -p   plain ASCII output only
        // -m   turn off MORE prompts
        // -R   restrict Frotz read/write to the specified folder
        // -Z   Suppress errors in output
        this.dFrotz = spawn('dfrotz', [
            '-f',
            'ansi',
            '-m',
            '-Z',
            '0',
            '-R',
            sharedData.gameFolder,
            this.gamePath,
        ]);

        // Create Frotz child process for the game
        //this.dFrotz = spawn('frotz', ['-p', '-Z', '0', '-R', sharedData.gameFolder, this.gamePath]);

        // Setup stream from frotz's stdout so that we can get its output
        this.dFrotz.stdout.on('data', (chunk) => {
            this.receiveFrotzOutput(chunk);
        });

        return true;
    }

    /**
     * Receives a chunk of data from the dfrotz output and processes it.
     *
     * @param {chunk} chunk - The chunk of data received from the dfrotz output.
     * @return None
     */
    receiveFrotzOutput(chunk) {
        let _string = this.decoder.write(chunk);

        this.rawOutput += _string;

        // this marks the end of input
        if (/(\n>)/.exec(this.rawOutput)) {
            this.cleanUpOutput();
        }
    }

    /**
     * Clean up the output by removing certain elements.
     *
     * @param {string} raw - The raw output to clean up.
     * @return {string} The cleaned up output.
     */
    cleanUpOutput() {
        let splitRaw = this.rawOutput.split(/\n/g);
        let outputArray = '';

        for (const element of splitRaw) {
            let cleanedElement = CleanAnsi.replace(element);

            if (this.shouldSkipElement(cleanedElement)) {
                continue;
            }

            if (cleanedElement.trim().startsWith('[rev]')) {
                this.gameHeader = cleanedElement
                    .substring(5, cleanedElement.length)
                    .trim();
                continue;
            }

            if (cleanedElement.trim().length === 0) {
                this.compiledOutput = outputArray;
                this.sendOutput();
                outputArray = '';
                continue;
            }

            outputArray += cleanedElement.trimEnd() + ' \n';
        }

        this.rawOutput = '';
        if (outputArray.length > 0) {
            this.compiledOutput = outputArray;
            this.sendOutput();
        }
    }

    shouldSkipElement(element) {
        const trimmedElement = element.trim();
        return (
            trimmedElement === 'Using ANSI formatting.' ||
            trimmedElement === 'Loading ' + this.gamePath + '.' ||
            trimmedElement.startsWith('Please enter a filename [') ||
            trimmedElement === '>' ||
            trimmedElement.length === 0
        );
    }

    /**
     * Sends the game output to the channel, splitting into multiple messages if needed.
     * Discord has a 2000 character limit per message.
     */
    sendOutput() {
        let final = Buffer.from(this.compiledOutput, 'utf-8').toString();

        // Don't send empty output
        if (final.length === 0) {
            return;
        }

        // Check if the message is too long for Discord (2000 char limit)
        if (final.length <= 1900) {
            // Short enough to send as a single message
            sharedData.channel.send(final).catch((error) => {
                Logger.log({
                    level: 'error',
                    message: `Error sending message to Discord: ${error.message}`,
                    stack: error.stack,
                });
            });
        } else {
            // Split the message into chunks of ~1900 characters
            // Try to split at paragraph boundaries when possible
            this.sendLongMessage(final);
        }

        this.compiledOutput = '';
    }

    /**
     * Splits a long message into multiple chunks and sends them sequentially
     *
     * @param {string} text - The full text to send
     */
    sendLongMessage(text) {
        const MAX_CHUNK_SIZE = 1900;
        const paragraphs = text.split(/\n\s*\n/);
        let currentChunk = '';

        for (const paragraph of paragraphs) {
            if (this.isChunkTooLarge(currentChunk, paragraph, MAX_CHUNK_SIZE)) {
                this.sendChunk(currentChunk);
                currentChunk = '';

                if (paragraph.length > MAX_CHUNK_SIZE) {
                    this.splitAndSendParagraph(paragraph, MAX_CHUNK_SIZE);
                } else {
                    this.sendChunk(paragraph);
                }
            } else {
                currentChunk += (currentChunk ? '\n\n' : '') + paragraph;
            }
        }

        if (currentChunk.length > 0) {
            this.sendChunk(currentChunk);
        }
    }

    isChunkTooLarge(currentChunk, paragraph, maxSize) {
        return currentChunk.length + paragraph.length + 2 > maxSize;
    }

    sendChunk(chunk) {
        if (chunk.length > 0) {
            sharedData.channel.send(chunk).catch((error) => {
                Logger.log({
                    level: 'error',
                    message: `Error sending chunk to Discord: ${error.message}`,
                    stack: error.stack,
                });
            });
        }
    }

    splitAndSendParagraph(paragraph, maxSize) {
        const lines = paragraph.split(/\n/);
        let lineChunk = '';

        for (const line of lines) {
            if (this.isChunkTooLarge(lineChunk, line, maxSize)) {
                this.sendChunk(lineChunk);
                lineChunk = '';

                if (line.length > maxSize) {
                    this.splitAndSendLine(line, maxSize);
                } else {
                    lineChunk = line;
                }
            } else {
                lineChunk += (lineChunk ? '\n' : '') + line;
            }
        }

        if (lineChunk.length > 0) {
            this.sendChunk(lineChunk);
        }
    }

    splitAndSendLine(line, maxSize) {
        for (let i = 0; i < line.length; i += maxSize) {
            const textChunk = line.substring(
                i,
                Math.min(i + maxSize, line.length)
            );
            this.sendChunk(textChunk);
        }
    }

    /**
     * Send the input message to dfrotz.
     *
     * @param {string} message - The input message to be processed.
     */
    processInput(message) {
        this.dFrotz.stdin.write(message + '\n');
    }

    /**
     * Stops the game and performs cleanup of the dfrotz child process.
     */
    stopGame() {
        // cleanup the child process
        this.dFrotz.kill();
    }

    /**
     * Save the game at the specified path.
     *
     * @param {string} savePath - The path where the game should be saved.
     */
    saveGame(savePath) {
        this.dFrotz.stdin.write('save\n');
        this.dFrotz.stdin.write(savePath + '\n');
    }

    /**
     * Restore the game from the specified path.
     *
     * @param {string} savePath - The path to teh save file to be restored.
     */
    restoreGame(savePath) {
        this.dFrotz.stdin.write('restore\n');
        this.dFrotz.stdin.write(savePath + '\n');
    }
}

export const Frotz = new FrotzClient();
