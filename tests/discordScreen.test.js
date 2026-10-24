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

        expect(onFlush).toHaveBeenCalledWith('You are in a maze.', null);
    });

    it('should strip the trailing game prompt', () => {
        screen.print(machine, 'You are in a maze.\n\n>');
        screen.flush();

        expect(onFlush).toHaveBeenCalledWith('You are in a maze.', null);
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

        expect(onFlush).toHaveBeenCalledWith('Goodbye.', null);
        expect(onQuit).toHaveBeenCalled();
    });
});
