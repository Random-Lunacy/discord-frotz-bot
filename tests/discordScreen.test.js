import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DiscordScreen } from '../discordScreen.js';

describe('DiscordScreen', () => {
    let onFlush;
    let screen;
    const machine = {};

    beforeEach(() => {
        onFlush = vi.fn();
        screen = new DiscordScreen(onFlush);
    });

    it('should hold output until flushed', () => {
        screen.print(machine, 'You are in a maze.');

        expect(onFlush).not.toHaveBeenCalled();

        screen.flush();

        expect(onFlush).toHaveBeenCalledWith('You are in a maze.', null, null);
    });

    it('should strip the trailing game prompt', () => {
        screen.print(machine, 'You are in a maze.\n\n>');
        screen.flush();

        expect(onFlush).toHaveBeenCalledWith('You are in a maze.', null, null);
    });

    it('should not flush empty output', () => {
        screen.print(machine, '\n>');
        screen.flush();

        expect(onFlush).not.toHaveBeenCalled();
    });

    it('should pass along the latest status line', () => {
        screen.updateStatusBar('West of House', 0, 3, false);
        screen.print(machine, 'Hello');
        screen.flush();

        const status = onFlush.mock.calls[0][1];
        expect(status).toContain('West of House');
    });

    it('should flush and notify when the game quits', () => {
        const onQuit = vi.fn();
        screen.onQuit = onQuit;
        screen.print(machine, 'Goodbye.');

        screen.quit();

        expect(onFlush).toHaveBeenCalledWith('Goodbye.', null, null);
        expect(onQuit).toHaveBeenCalled();
    });

    it('should strip a doubled game prompt', () => {
        screen.print(machine, 'Type RESTORE to restore.\n>>');
        screen.flush();

        expect(onFlush).toHaveBeenCalledWith('Type RESTORE to restore.', null, null);
    });

    it('should shorten long runs of blank lines', () => {
        screen.print(machine, 'A title\n\n\n\n\n\n\n[Hit any key.]');
        screen.flush();

        expect(onFlush).toHaveBeenCalledWith('A title\n\n[Hit any key.]', null, null);
    });

    it('should keep the layout of aligned text in a code block', () => {
        screen.print(
            machine,
            '"Tomorrow never yet\n                On any human being rose or set."\n                        -- William Marsden\n\nThe end.'
        );
        screen.flush();

        const [text] = onFlush.mock.calls[0];
        expect(text).toBe(
            '```\n"Tomorrow never yet\n                On any human being rose or set."\n                        -- William Marsden\n```\n\nThe end.'
        );
    });

    it('should only send a status line again when it changes', () => {
        screen.updateStatusBar('West of House', 0, 1, false);
        screen.print(machine, 'One.');
        screen.flush();
        screen.print(machine, 'Two.');
        screen.flush();
        screen.updateStatusBar('West of House', 0, 2, false);
        screen.print(machine, 'Three.');
        screen.flush();

        const statuses = onFlush.mock.calls.map(([, status]) => status);
        expect(statuses[0]).toContain('West of House');
        expect(statuses[1]).toBeNull();
        expect(statuses[2]).toContain('West of House');
    });

    describe('upper window (V4 and later)', () => {
        const v5 = { state: { version: 5 } };

        // What a V5 game does to draw a line at a position in the upper window
        const drawAt = (line, column, text) => {
            screen.setOutputWindow(v5, 1);
            screen.setCursorPosition(v5, line, column, 1);
            screen.print(v5, text);
            screen.setOutputWindow(v5, 0);
        };

        it('should show a one line upper window as a status line', () => {
            screen.splitWindow(v5, 1);
            drawAt(1, 3, 'At End Of Road');
            drawAt(1, 40, 'Score: 36    Moves: 1');
            screen.print(v5, 'You are at the end of a road.');
            screen.flush();

            expect(onFlush).toHaveBeenCalledWith(
                'You are at the end of a road.',
                'At End Of Road · Score: 36 · Moves: 1',
                null
            );
        });

        it('should send a several line upper window as a code block', () => {
            screen.splitWindow(v5, 3);
            drawAt(1, 10, 'TRINITY');
            drawAt(3, 5, 'An Interactive Fiction');
            screen.print(v5, '[Press any key.]');
            screen.flush();

            const [text, status, block] = onFlush.mock.calls[0];
            expect(text).toBe('[Press any key.]');
            expect(status).toBeNull();
            expect(block).toBe('```\n     TRINITY\n\nAn Interactive Fiction\n```');
        });

        it('should not send the same block twice', () => {
            screen.splitWindow(v5, 2);
            drawAt(1, 1, 'FORM');
            drawAt(2, 1, 'Name:');
            screen.print(v5, 'First.');
            screen.flush();
            screen.print(v5, 'Second.');
            screen.flush();
            drawAt(2, 7, 'Mitch');
            screen.print(v5, 'Third.');
            screen.flush();

            const blocks = onFlush.mock.calls.map(([, , block]) => block);
            expect(blocks[0]).toContain('Name:');
            expect(blocks[1]).toBeNull();
            expect(blocks[2]).toContain('Name: Mitch');
        });

        it('should send a changed block even when the game printed no other text', () => {
            screen.splitWindow(v5, 2);
            drawAt(1, 1, 'FORM');
            drawAt(2, 1, 'Name:');

            screen.flush();

            expect(onFlush).toHaveBeenCalledWith('', null, expect.stringContaining('Name:'));
        });

        it('should ignore rows below the window the game has split off', () => {
            screen.splitWindow(v5, 2);
            drawAt(1, 1, 'Visible one');
            drawAt(2, 1, 'Visible two');
            screen.splitWindow(v5, 1);
            screen.print(v5, 'Text.');
            screen.flush();

            const [, status, block] = onFlush.mock.calls[0];
            expect(block).toBeNull();
            expect(status).toBe('Visible one');
        });

        it('should send a block again if it goes away and comes back', () => {
            screen.splitWindow(v5, 2);
            drawAt(1, 1, 'FORM');
            drawAt(2, 1, 'Name:');
            screen.print(v5, 'One.');
            screen.flush();

            screen.clearWindow(v5, 1);
            screen.print(v5, 'Two.');
            screen.flush();

            drawAt(1, 1, 'FORM');
            drawAt(2, 1, 'Name:');
            screen.print(v5, 'Three.');
            screen.flush();

            const blocks = onFlush.mock.calls.map(([, , block]) => block);
            expect(blocks.map(Boolean)).toEqual([true, false, true]);
        });
    });

    describe('after the bot cancelled a save or restore', () => {
        it('should drop the game\'s own Failed. notice, once', () => {
            screen.suppressFailure = true;
            screen.print(machine, 'Failed.\n\n>');
            screen.flush();
            screen.print(machine, 'Failed.');
            screen.flush();

            expect(onFlush).toHaveBeenCalledTimes(1);
            expect(onFlush).toHaveBeenCalledWith('Failed.', null, null);
            expect(screen.suppressFailure).toBe(false);
        });

        it('should keep any other text the game printed', () => {
            screen.suppressFailure = true;
            screen.print(machine, 'Failed.\n\nYou are in a maze.');
            screen.flush();

            expect(onFlush).toHaveBeenCalledWith('Failed.\n\nYou are in a maze.', null, null);
        });

        it('should not lose the status line when the notice is dropped', () => {
            screen.updateStatusBar('West of House', 0, 1, false);
            screen.suppressFailure = true;
            screen.print(machine, 'Failed.');
            screen.flush();
            expect(onFlush).not.toHaveBeenCalled();

            screen.print(machine, 'Next.');
            screen.flush();

            expect(onFlush.mock.calls[0][1]).toContain('West of House');
        });

        it('should show a Failed. notice when the bot did not cancel anything', () => {
            screen.print(machine, 'Failed.');
            screen.flush();

            expect(onFlush).toHaveBeenCalledWith('Failed.', null, null);
        });
    });
});
