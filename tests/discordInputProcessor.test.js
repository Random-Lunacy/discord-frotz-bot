import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DiscordInputProcessor } from '../discordInputProcessor.js';

describe('DiscordInputProcessor', () => {
    let screen;
    let prompts;
    let input;

    beforeEach(() => {
        screen = { flush: vi.fn() };
        prompts = {
            save: vi.fn().mockResolvedValue('/games/new-save.qzl'),
            restore: vi.fn().mockResolvedValue('/games/old-save.qzl'),
        };
        input = new DiscordInputProcessor(screen, prompts);
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

    it('should use a queued filename once, then ask the player', async () => {
        input.setNextFilename('/games/zork-1.qzl');

        expect(await input.promptForFilename({}, 'restore')).toBe(
            '/games/zork-1.qzl'
        );
        expect(prompts.restore).not.toHaveBeenCalled();

        expect(await input.promptForFilename({}, 'restore')).toBe(
            '/games/old-save.qzl'
        );
        expect(prompts.restore).toHaveBeenCalledTimes(1);
    });

    it('should ask the player for a name when the game saves', async () => {
        expect(await input.promptForFilename({}, 'save')).toBe(
            '/games/new-save.qzl'
        );
        expect(prompts.save).toHaveBeenCalled();
    });
});
