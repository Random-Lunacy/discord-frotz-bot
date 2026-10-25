import { describe, it, expect } from 'vitest';
import { PermissionFlagsBits, PermissionsBitField } from 'discord.js';
import { isAdmin } from '../permissions.js';

// Uses discord.js's real permission handling, so this checks what a real server would send.
const asUser = (...flags) => ({ memberPermissions: new PermissionsBitField(flags) });

describe('isAdmin', () => {
    it('should be true for someone who can manage the server', () => {
        expect(isAdmin(asUser(PermissionFlagsBits.ManageGuild))).toBe(true);
    });

    it('should be true for an administrator, who can do everything', () => {
        expect(isAdmin(asUser(PermissionFlagsBits.Administrator))).toBe(true);
    });

    it('should be false for an ordinary member', () => {
        expect(
            isAdmin(asUser(PermissionFlagsBits.SendMessages, PermissionFlagsBits.ViewChannel))
        ).toBe(false);
    });

    it('should be false for someone who can only manage messages or threads', () => {
        expect(
            isAdmin(asUser(PermissionFlagsBits.ManageMessages, PermissionFlagsBits.ManageThreads))
        ).toBe(false);
    });

    it('should be false when there are no member permissions, as in a direct message', () => {
        expect(isAdmin({ memberPermissions: null })).toBe(false);
        expect(isAdmin({})).toBe(false);
    });
});
