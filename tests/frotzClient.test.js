import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Frotz } from '../frotzClient.js';
import { EventEmitter } from 'node:events';

// Mock dependencies properly with hoisting in mind
vi.mock('child_process', () => {
    return {
        spawn: vi.fn(() => ({
            stdout: new EventEmitter(),
            stdin: { write: vi.fn() },
            kill: vi.fn(),
        })),
    };
});

vi.mock('fs', () => ({
    default: {
        existsSync: vi.fn(),
    },
    existsSync: vi.fn(),
}));

vi.mock('../sharedData.js', () => ({
    sharedData: {
        gameFolder: '/test/games',
        channel: {
            send: vi.fn().mockResolvedValue({}),
        },
    },
}));

// Import the mocks after they've been defined
import { spawn } from 'child_process';
import fs from 'fs';
describe('FrotzClient', () => {
    beforeEach(() => {
        // Reset mocks
        vi.clearAllMocks();

        // Reset client state
        Frotz.dFrotz = null;
        Frotz.rawOutput = '';
        Frotz.compiledOutput = '';

        // Set default mock returns
        fs.existsSync.mockReturnValue(true);
    });

    describe('verifyGameFile', () => {
        it('should return true if the file exists', () => {
            fs.existsSync.mockReturnValue(true);

            const result = Frotz.verifyGameFile('/test/game.z5');

            expect(result).toBe(true);
            expect(fs.existsSync).toHaveBeenCalledWith('/test/game.z5');
        });

        it('should return false if the file does not exist', () => {
            fs.existsSync.mockReturnValue(false);

            const result = Frotz.verifyGameFile('/test/nonexistent.z5');

            expect(result).toBe(false);
            expect(fs.existsSync).toHaveBeenCalledWith('/test/nonexistent.z5');
        });
    });

    describe('startGame', () => {
        it('should return false if game file does not exist', () => {
            fs.existsSync.mockReturnValue(false);

            const result = Frotz.startGame('nonexistent.z5');

            expect(result).toBe(false);
            expect(Frotz.lastError).toBeDefined();
            expect(spawn).not.toHaveBeenCalled();
        });

        it('should spawn dfrotz process if game file exists', () => {
            fs.existsSync.mockReturnValue(true);

            const result = Frotz.startGame('zork1.z5');

            expect(result).toBe(true);
            expect(spawn).toHaveBeenCalledWith(
                'dfrotz',
                expect.arrayContaining(['/test/games/zork1.z5'])
            );
        });
    });

    // Add more test cases for other methods...
});
