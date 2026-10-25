import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'node:fs';

// The entry point: it makes the Discord client, loads every event handler, and logs in.
const mockClient = vi.hoisted(() => ({
    on: vi.fn(),
    once: vi.fn(),
    login: vi.fn(),
}));
const ClientMock = vi.hoisted(() => vi.fn());
const mockShutdown = { registerShutdownHandlers: vi.fn() };
const mockShared = vi.hoisted(() => ({ sharedData: { client: null } }));

vi.mock('discord.js', () => ({
    Client: ClientMock,
    GatewayIntentBits: { Guilds: 1, GuildMessages: 2, MessageContent: 4 },
}));
vi.mock('../sharedData.js', () => mockShared);
vi.mock('../shutdown.js', () => mockShutdown);

// The event handlers, replaced so loading them does nothing
const eventFiles = fs.readdirSync('./events').filter((file) => file.endsWith('.js'));
const eventModules = {};
for (const file of eventFiles) {
    const name = file.slice(0, -3);
    eventModules[name] = { name: `${name}Event`, once: name === 'ready', invoke: vi.fn() };
    vi.doMock(`../events/${file}`, () => eventModules[name]);
}

describe('frotz-bot.js', () => {
    beforeEach(async () => {
        vi.resetModules();
        vi.clearAllMocks();
        ClientMock.mockImplementation(function () {
            return mockClient;
        });
        await import('../frotz-bot.js');
    });

    it('should ask Discord for the guilds, guild messages and message content', () => {
        expect(ClientMock).toHaveBeenCalledWith({ intents: [1, 2, 4] });
    });

    it('should share the client with the rest of the bot', () => {
        expect(mockShared.sharedData.client).toBe(mockClient);
    });

    it('should save running games when it is told to stop', () => {
        expect(mockShutdown.registerShutdownHandlers).toHaveBeenCalledWith(mockClient);
    });

    it('should register every event file once, and only once-events with once()', () => {
        const registered = [...mockClient.on.mock.calls, ...mockClient.once.mock.calls].map(([name]) => name);

        expect(registered.sort()).toEqual(Object.values(eventModules).map((m) => m.name).sort());
        expect(mockClient.once.mock.calls.map(([name]) => name)).toEqual(['readyEvent']);
    });

    it('should pass an event on to its handler', () => {
        const [, listener] = mockClient.on.mock.calls.find(([name]) => name === 'threadDeleteEvent');

        listener('a', 'b');

        expect(eventModules.threadDelete.invoke).toHaveBeenCalledWith('a', 'b');
    });

    it('should log in', () => {
        expect(mockClient.login).toHaveBeenCalledTimes(1);
    });
});
