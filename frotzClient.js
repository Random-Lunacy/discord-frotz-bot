import { sharedData } from './sharedData.js';
import { } from 'dotenv/config';
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
                message: `Failed to launch Frotz: the game file ${gameFile} does not exist.`
            });
            this.lastError = new Error(`Failed to launch Frotz: the game file ${gameFile} does not exist.`);
            return false;
        }

        Logger.log({
            level: 'info',
            message: `Launching Frotz: ${this.gamePath}`
        });

        // Create dFrotz child process for the game
        // -p   plain ASCII output only
        // -m   turn off MORE prompts
        // -R   restrict Frotz read/write to the specified folder
        // -Z   Suppress errors in output
        this.dFrotz = spawn('dfrotz', ['-f', 'ansi', '-m', '-Z', '0', '-R', sharedData.gameFolder, this.gamePath]);

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
        if (this.rawOutput.match(/(\n>)/)) {
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

            // Skip lines we don't want to output to Discord
            if (cleanedElement.trim() === 'Using ANSI formatting.'
                || cleanedElement.trim() === 'Loading ' + this.gamePath + '.'
                || cleanedElement.trim() === ('>')
                || cleanedElement.trim().startsWith('Please enter a filename [')
                || cleanedElement.length === 0) {
                continue;
            }

            // Grab the game header line
            if (cleanedElement.trim().startsWith('[rev]')) {
                this.gameHeader = cleanedElement.substring(5, cleanedElement.length)
                    .trim()
                    .replace(/\s\s+/, ' - ')
                    .replace(/\s+/g, ' ');
                continue;
            }

            // If we've got an empty line, send the output we've collected so far
            if (cleanedElement.trim().length === 0) {
                this.compiledOutput = outputArray;
                this.sendOutput();
                outputArray = '';
                continue;
            }

            outputArray += cleanedElement.trimEnd() + ' \n';
        }

        // Clean up and send any remaining output
        this.rawOutput = '';
        if (outputArray.length > 0) {
            this.compiledOutput = outputArray;
            this.sendOutput();
        }
    }

    /**
     * Sends the game output to the channel.
     */
    async sendOutput() {
        let final = Buffer.from(this.compiledOutput, 'utf-8').toString();

        // Don't send empty output
        if (final.length > 0) {
            sharedData.thread.send(final);
        }

        // Update the thread name to include the game header
        let newName = sharedData.gameList.games.filter(it => it.id === sharedData.gameId)[0].name + ' - ' + this.gameHeader;
        if (sharedData.thread.name !== newName) {
            await sharedData.thread.setName(newName);
        }

        // Reset the compiled output
        this.compiledOutput = '';
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
