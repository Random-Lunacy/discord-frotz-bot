import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// The parts of the client that the game-playing tests don't reach: splitting long output for
// Discord's message limit, failures sending to Discord, a game that never becomes ready, saves
// with unusable names, and Blorb story files.

const gameFolder = path.resolve('games');
const state = vi.hoisted(() => ({ gameFolder: '' }));
const log = vi.fn();

vi.mock('../sharedData.js', () => ({
    sharedData: {
        get gameFolder() {
            return state.gameFolder;
        },
    },
}));
vi.mock('../logger.js', () => ({ Logger: { log } }));

const { ZMachineClient } = await import('../zmachineClient.js');

const hasZork = fs.existsSync(`${gameFolder}/zork-i.z3`);
const tick = (ms = 150) => new Promise((resolve) => setTimeout(resolve, ms));

const MAX = 1900;

describe('ZMachineClient edge cases', () => {
    let channel;
    let client;
    let sent;

    beforeEach(() => {
        vi.clearAllMocks();
        vi.useRealTimers();
        state.gameFolder = fs.mkdtempSync(path.join(os.tmpdir(), 'client-edges-'));
        sent = [];
        channel = {
            id: 't1',
            send: vi.fn(async (message) => {
                sent.push(typeof message === 'string' ? message : message.content);
                return { delete: vi.fn() };
            }),
        };
        client = new ZMachineClient({ channel, gameId: 'zork1', gameName: 'Zork I' });
    });

    afterEach(() => {
        client.stopGame();
        vi.useRealTimers();
        fs.rmSync(state.gameFolder, { recursive: true, force: true });
    });

    describe('long output', () => {
        const paragraph = (label, length) => `${label} ${'word '.repeat(Math.ceil(length / 5))}`.slice(0, length);
        const squash = (text) => text.replace(/\s+/g, ' ').trim();

        it('should send text that fits as one message', () => {
            client.sendOutput('Short text.', null);

            expect(sent).toEqual(['Short text.']);
        });

        it('should split a long message at paragraph breaks, keeping everything in order', () => {
            const paragraphs = ['A', 'B', 'C', 'D', 'E'].map((label) => paragraph(label, 700));

            client.sendOutput(paragraphs.join('\n\n'), null);

            expect(sent.length).toBeGreaterThan(1);
            for (const message of sent) {
                expect(message.length).toBeLessThanOrEqual(MAX);
            }
            expect(squash(sent.join(' '))).toBe(squash(paragraphs.join(' ')));
            // Nothing is cut in the middle of a paragraph
            for (const text of paragraphs) {
                expect(sent.some((message) => message.includes(text))).toBe(true);
            }
        });

        it('should split a long paragraph between its lines', () => {
            const lines = Array.from({ length: 40 }, (_, i) => paragraph(`line${i}`, 99));

            client.sendOutput(lines.join('\n'), null);

            expect(sent.length).toBeGreaterThan(1);
            for (const message of sent) {
                expect(message.length).toBeLessThanOrEqual(MAX);
            }
            expect(sent.join('\n').split('\n')).toEqual(lines);
        });

        it('should split a single enormous line into pieces', () => {
            const line = 'x'.repeat(4500);

            client.sendOutput(line, null);

            expect(sent.map((message) => message.length)).toEqual([MAX, MAX, 4500 - 2 * MAX]);
            expect(sent.join('')).toBe(line);
        });

        it('should put the status line at the start of the first message', () => {
            const text = ['A', 'B', 'C'].map((label) => paragraph(label, 900)).join('\n\n');

            client.sendOutput(text, 'West of House · Score: 0');

            expect(sent[0].startsWith('-# West of House · Score: 0\n')).toBe(true);
            expect(sent.slice(1).every((message) => !message.startsWith('-#'))).toBe(true);
        });

        it('should send a block of positioned text as a message of its own, first', () => {
            client.sendOutput('Text.', null, '```\nTITLE\n```');

            expect(sent).toEqual(['```\nTITLE\n```', 'Text.']);
        });
    });

    describe('when Discord rejects a message', () => {
        const errors = () => log.mock.calls.filter(([entry]) => entry.level === 'error').map(([entry]) => entry.message);

        beforeEach(() => {
            channel.send.mockRejectedValue(new Error('Missing Permissions'));
        });

        it('should log it when sending game text', async () => {
            client.sendOutput('Text.', null);
            await tick(20);

            expect(errors()).toEqual([expect.stringContaining('Error sending message to Discord: Missing Permissions')]);
        });

        it('should log it when sending a long message in pieces', async () => {
            client.sendOutput('x'.repeat(4000), null);
            await tick(20);

            expect(errors().length).toBeGreaterThanOrEqual(2);
            expect(errors()[0]).toContain('Error sending chunk to Discord');
        });

        it('should log it when saying something', async () => {
            client.say('Hello');
            await tick(20);

            expect(errors()).toEqual([expect.stringContaining('Error sending message to Discord')]);
        });

        it('should log it when posting the Continue button', async () => {
            client.postKeyPrompt();
            await tick(20);

            expect(errors()).toEqual([expect.stringContaining('Error sending the Continue button')]);
        });
    });

    describe('with no game', () => {
        it('should not accept a message', () => {
            expect(client.handleMessage({ content: 'look', author: { id: 'u1' } })).toBe(false);
        });

        it('should not be able to auto-save', async () => {
            expect(await client.autoSave('u1')).toBeNull();
        });
    });

    describe('a game that never becomes ready', () => {
        beforeEach(() => {
            vi.useFakeTimers();
            client.machine = { quit: vi.fn() };
            client.input = {
                waiting: false,
                anyKeyPending: true,
                submit: vi.fn(),
                setNextFilename: vi.fn(),
                cancelInput: vi.fn(),
            };
        });

        it('should report that it is not ready', async () => {
            const result = client.whenReady(100);
            await vi.advanceTimersByTimeAsync(200);

            expect(await result).toBe(false);
        });

        it('should give up on pressing through a "press any key" screen', async () => {
            const result = client.passAnyKeyPrompts();
            await vi.advanceTimersByTimeAsync(6000);

            expect(await result).toBe(false);
            expect(client.input.submit).toHaveBeenCalledWith('\r');
        });

        it('should not restore, and say so', async () => {
            const result = client.restoreGame('/games/save.qzl');
            await vi.advanceTimersByTimeAsync(6000);

            expect(await result).toBe(false);
            expect(client.input.setNextFilename).not.toHaveBeenCalled();
        });

        it('should report no save when the game does not come back to its prompt after saving', async () => {
            client.input.anyKeyPending = false;
            client.input.waiting = true;
            client.input.submit = vi.fn(() => {
                client.input.waiting = false;
            });

            const result = client.autoSave('u1');
            await vi.advanceTimersByTimeAsync(6000);

            expect(await result).toBeNull();
            expect(client.input.submit).toHaveBeenCalledWith('save');
        });

        it('should not auto-save', async () => {
            client.input.anyKeyPending = false;

            const result = client.autoSave('u1');
            await vi.advanceTimersByTimeAsync(6000);

            expect(await result).toBeNull();
            expect(client.silent).toBe(false);
        });
    });

    it('should report no save when the game finished but wrote nothing', async () => {
        client.machine = { quit: vi.fn() };
        client.input = {
            waiting: true,
            anyKeyPending: false,
            submit: vi.fn(),
            setNextFilename: vi.fn(),
            cancelInput: vi.fn(),
        };

        expect(await client.autoSave('u1')).toBeNull();
        expect(client.input.submit).toHaveBeenCalledWith('save');
    });

    describe('naming and choosing saves', () => {
        it('should use the default name when the player types something with no letters or numbers', async () => {
            client.lastUserId = 'u1';
            const path = client.promptSaveName();
            client.pendingPrompt.answer('!!! ???');

            const savePath = await path;

            expect(savePath).toMatch(/zork1-t1-u1-\d+-player_\d{8}_\d{4}\.qzl$/);
            expect(sent.join('\n')).toContain('no usable letters or numbers, using the default name');
        });

        it('should restore the newest save when the player answers "latest"', async () => {
            for (const name of ['zork1-t9-u1-900.qzl', 'zork1-t1-u1-100.qzl']) {
                fs.writeFileSync(path.join(state.gameFolder, name), '');
            }
            client.lastUserId = 'u1';

            const chosen = client.promptRestoreName();
            await tick(10);
            client.pendingPrompt.answer('Latest');

            // Saves from this thread come first, so "latest" is this thread's newest
            expect(await chosen).toBe(`${state.gameFolder}/zork1-t1-u1-100.qzl`);
        });

        it('should restore nothing when the answer is not a choice on the list', async () => {
            fs.writeFileSync(path.join(state.gameFolder, 'zork1-t1-u1-100.qzl'), '');
            client.lastUserId = 'u1';

            const chosen = client.promptRestoreName();
            await tick(10);
            client.pendingPrompt.answer('7');

            expect(await chosen).toBe('');
            expect(sent.join('\n')).toContain('Restore cancelled.');
        });
    });

    describe.skipIf(!hasZork)('a story file in a Blorb', () => {
        /** Wrap a story file in the smallest Blorb that holds it as the executable. */
        const blorbOf = (story, usage = 'Exec') => {
            const padded = story.length % 2 ? Buffer.concat([story, Buffer.alloc(1)]) : story;
            const index = Buffer.alloc(8 + 4 + 12);
            index.write('RIdx', 0, 'ascii');
            index.writeUInt32BE(16, 4);
            index.writeUInt32BE(1, 8);
            index.write(usage, 12, 'ascii');
            index.writeUInt32BE(0, 16);
            index.writeUInt32BE(12 + index.length, 20); // where the story chunk starts

            const chunk = Buffer.alloc(8);
            chunk.write('ZCOD', 0, 'ascii');
            chunk.writeUInt32BE(story.length, 4);

            const body = Buffer.concat([Buffer.from('IFRS'), index, chunk, padded]);
            const header = Buffer.alloc(8);
            header.write('FORM', 0, 'ascii');
            header.writeUInt32BE(body.length, 4);
            return Buffer.concat([header, body]);
        };

        it('should play the story inside it', async () => {
            const story = fs.readFileSync(`${gameFolder}/zork-i.z3`);
            fs.writeFileSync(path.join(state.gameFolder, 'zork.blb'), blorbOf(story));

            expect(client.startGame('zork.blb')).toBe(true);
            await tick(300);

            expect(sent.join('\n')).toContain('ZORK I: The Great Underground Empire');
        });

        it('should refuse a Blorb that has no story in it', () => {
            const story = fs.readFileSync(`${gameFolder}/zork-i.z3`);
            fs.writeFileSync(path.join(state.gameFolder, 'pictures.blb'), blorbOf(story, 'Pict'));

            expect(client.startGame('pictures.blb')).toBe(false);
            expect(client.lastError.message).toContain('Failed to start game');
        });
    });
});
