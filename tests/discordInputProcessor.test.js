import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DiscordInputProcessor } from '../discordInputProcessor.js';

describe('DiscordInputProcessor', () => {
    let screen;
    let prompts;
    let input;

    beforeEach(() => {
        screen = { flush: vi.fn(), lastText: '' };
        prompts = {
            anyKey: vi.fn(),
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

    it('should expect the game\'s Failed. notice when the bot cancelled a save or restore', async () => {
        prompts.save.mockResolvedValue('');
        prompts.restore.mockResolvedValue('');

        await input.promptForFilename({}, 'save');
        expect(screen.suppressFailure).toBe(true);

        screen.suppressFailure = false;
        await input.promptForFilename({}, 'restore');
        expect(screen.suppressFailure).toBe(true);
    });

    it('should show the game\'s Failed. notice when a save or restore was really attempted', async () => {
        await input.promptForFilename({}, 'save');
        input.setNextFilename('/games/x.qzl');
        await input.promptForFilename({}, 'restore');

        expect(screen.suppressFailure).toBeFalsy();
    });

    it('should ask the player for a name when the game saves', async () => {
        expect(await input.promptForFilename({}, 'save')).toBe(
            '/games/new-save.qzl'
        );
        expect(prompts.save).toHaveBeenCalled();
    });

    describe('press any key prompts', () => {
        beforeEach(() => {
            screen.lastText = 'The story begins.\n\n[Press any key to begin.]';
            input.doStartCharInput();
        });

        it('should ask for the Continue button when the game pauses for any key', () => {
            expect(input.anyKeyPending).toBe(true);
            expect(prompts.anyKey).toHaveBeenCalledTimes(1);
        });

        it('should not ask for the button when the game wants a particular key', () => {
            prompts.anyKey.mockClear();
            screen.lastText = 'Do you want to continue? (y/n)';

            input.doStartCharInput();

            expect(input.anyKeyPending).toBe(false);
            expect(prompts.anyKey).not.toHaveBeenCalled();
        });

        it('should press Enter when the player types a single character', () => {
            input.submit('x');

            expect(input.onKeyPress).toHaveBeenCalledWith(input.machine, '\r');
            expect(input.queuedLine).toBeNull();
            expect(input.anyKeyPending).toBe(false);
        });

        it('should press Enter and keep what the player typed as their next command', () => {
            input.submit('look at the sundial');

            expect(input.onKeyPress).toHaveBeenCalledWith(input.machine, '\r');
            expect(input.queuedLine).toBe('look at the sundial');
        });

        it('should send the kept command when the game next asks for a line', () => {
            vi.useFakeTimers();
            try {
                input.submit('look');

                input.doStartTextInput();
                vi.runAllTimers();

                expect(input.onInputComplete).toHaveBeenCalledWith(input.machine, 'look', 13);
                expect(input.queuedLine).toBeNull();
            } finally {
                vi.useRealTimers();
            }
        });

        it('should still use the first character at a prompt that is not a pause', () => {
            screen.lastText = 'Which way? [N/S/E/W]';
            input.doStartCharInput();

            input.submit('north');

            expect(input.onKeyPress).toHaveBeenCalledWith(input.machine, 'n');
            expect(input.queuedLine).toBeNull();
        });
    });
});
