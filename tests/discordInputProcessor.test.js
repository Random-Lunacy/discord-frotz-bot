import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DiscordInputProcessor } from '../discordInputProcessor.js';

describe('DiscordInputProcessor', () => {
    let screen;
    let input;

    beforeEach(() => {
        screen = { flush: vi.fn() };
        input = new DiscordInputProcessor(screen);
        input.machine = {};
        input.onInputComplete = vi.fn();
        input.onKeyPress = vi.fn();
    });

    it('should flush output and wait when the game asks for a line', () => {
        input.doStartTextInput();

        expect(screen.flush).toHaveBeenCalled();
        expect(input.waiting).toBe(true);
    });

    it('should ignore input when the game is not waiting', () => {
        expect(input.submit('look')).toBe(false);
        expect(input.onInputComplete).not.toHaveBeenCalled();
    });

    it('should complete a line of input', () => {
        input.doStartTextInput();

        expect(input.submit('look')).toBe(true);
        expect(input.onInputComplete).toHaveBeenCalledWith(input.machine, 'look', 13);
        expect(input.waiting).toBe(false);
    });

    it('should send a single key for character input', () => {
        input.doStartCharInput();

        input.submit('yes');

        expect(input.onKeyPress).toHaveBeenCalledWith(input.machine, 'y');
    });

    it('should only use a queued filename once', async () => {
        input.setNextFilename('/games/zork-1.qzl');

        expect(await input.promptForFilename()).toBe('/games/zork-1.qzl');
        expect(await input.promptForFilename()).toBe('');
    });
});
