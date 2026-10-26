# Running the bot on a server

The bot is a plain Node.js program: `node ./frotz-bot.js`, run from the bot's folder (it reads `./events`, `./games`,
`./logs` and `.env` from there). This page covers keeping it running, restarting it without losing anyone's game,
updating it, and upgrading from the older version that used `dfrotz`.

-   [How stopping works](#how-stopping-works)
-   [systemd (recommended)](#systemd-recommended)
-   [screen](#screen)
-   [pm2](#pm2)
-   [Installing Node.js 22 or later (Ubuntu)](#installing-nodejs-22-or-later-ubuntu)
-   [Updating](#updating)
-   [Upgrading from the dfrotz version](#upgrading-from-the-dfrotz-version)

## How stopping works

When the bot is told to stop it saves every running game, tells each game's thread, and exits. It does this for Ctrl+C
(`SIGINT`), `kill` and service stops (`SIGTERM`), and the terminal going away, for example `screen -X quit` (`SIGHUP`).
It allows itself 15 seconds. Players then use `/restore` in their thread once the bot is back. See
[Automatic saves](../README.md#automatic-saves).

Two things matter for how you run it:

-   **The signal has to reach `node`.** `npm start` starts node as a child, and stopping `npm` (for example `kill` on its
    process, or a service manager stopping it) does **not** pass the signal on: npm exits and the bot is left running
    with no save. Run `node ./frotz-bot.js` directly in a service. (Ctrl+C typed in a terminal is different: the
    terminal sends it to the whole process group, so it reaches the bot even under `npm run start`.)
-   **Whatever stops the bot must wait.** If something kills it after only a second or two, the saves are cut short.
    systemd waits 90 seconds by default, and the unit below sets 30; pm2 waits only 1.6 seconds by default and needs
    changing (see below).

A forced kill (`kill -9`), a crash, or a power cut cannot be saved. Games are only lost if they had unsaved progress.

## systemd (recommended)

Tested on an Ubuntu 24.04 server: stopping the service with a game running saved the game, and after updating the
bot and starting the service again, `/restore` in the game's thread brought it back. Also tested with a stand-in process
under systemd: a crash was restarted with a new process (`Restart=on-failure`).

1. Find the full path to node, and check its version is 22.12 or later:
    ```sh
    command -v node
    node --version
    ```
    If node was installed with nvm, its path contains the version (for example `/home/you/.nvm/versions/node/v22.12.0/bin/node`);
    systemd does not load nvm, so use that full path. It changes when you switch versions.
2. Make a copy of [`deploy/frotz-bot.service`](../deploy/frotz-bot.service) in your home folder, edit the three lines
   marked in its header (`User`, `WorkingDirectory` and `ExecStart`), and check it. None of this needs `sudo`; only
   the last command does, because `/etc/systemd/system` belongs to root.
    ```sh
    cp ~/discord-frotz-bot/deploy/frotz-bot.service ~/frotz-bot.service
    nano ~/frotz-bot.service                       # or any editor
    systemd-analyze verify ~/frotz-bot.service     # no output means it is fine
    sudo cp ~/frotz-bot.service /etc/systemd/system/frotz-bot.service
    ```
   To change the installed unit later, edit it with `sudo systemctl edit --full frotz-bot` (or edit your copy and
   `sudo cp` it again), then run `sudo systemctl daemon-reload`.
3. **Remove anything else that starts the bot.** If a crontab entry (`crontab -l`, for example
   `@reboot sh /home/you/startFrotzBot.sh`) or another startup script launches it, delete that line with `crontab -e`.
   Two copies of the bot on one token would each answer every command, and after a reboot cron would start the second
   one. Stop any copy that is running now (for the screen setup, `screen -r FROTZ` then Ctrl+C) before the next step.
4. Start it, and have it start at boot:
    ```sh
    sudo systemctl daemon-reload
    sudo systemctl enable --now frotz-bot
    ```

Day to day (`systemctl status` works without `sudo`, and so does `journalctl` if you are in the `adm` group, which the
first user on an Ubuntu install is; starting, stopping and restarting need `sudo`):

```sh
systemctl status frotz-bot          # is it running?
journalctl -u frotz-bot -f          # follow the log (the bot also writes logs/combined.log and logs/error.log)
sudo systemctl restart frotz-bot    # saves running games, then restarts
sudo systemctl stop frotz-bot       # saves running games, then stops
```

`Restart=on-failure` brings the bot back after a crash (after 10 seconds) but not after a normal stop, so
`systemctl stop` stays stopped. The `.env` file is read by the bot itself from `WorkingDirectory`, so nothing about it
goes in the unit.

## screen

This is what the original startup script does:

```sh
#!/bin/sh
cd /home/you/discord-frotz-bot/
screen -dmS FROTZ npm run start
```

It works, and stopping from inside the session (Ctrl+C) reaches the bot. Better to run node directly, so the signal
path is the simple one:

```sh
#!/bin/sh
cd /home/you/discord-frotz-bot/ || exit 1
screen -dmS FROTZ node ./frotz-bot.js
```

Stop it so that games are saved, any of these:

```sh
screen -r FROTZ                                  # attach, then press Ctrl+C
screen -S FROTZ -X stuff "$(printf '\003')"      # type Ctrl+C into the session from outside
pkill -TERM -f '^node ./frotz-bot.js'            # signal node itself (works however it was started)
```

Tested with a stand-in process: Ctrl+C typed into the session, `screen -X stuff` with Ctrl+C, and `screen -X quit`
(SIGHUP) all reached the program, with `npm run start` and with `node` directly. What does **not** work is `kill` on the
`npm` process, as described above.

To start it at boot without a service, add `@reboot /home/you/start-frotz.sh` to your crontab (`crontab -e`). A service
is better: it restarts the bot after a crash, gives you a log, and is stopped properly when the machine shuts down or
reboots (systemd waits for the bot to save its games; with cron and screen, nothing waits for it, so the saves are not
reliable). If you move to a service, remove the crontab line.

## pm2

Not tested here. pm2 keeps the process running and can start it at boot:

```sh
npm install -g pm2
pm2 start ./frotz-bot.js --name frotz-bot --kill-timeout 30000
pm2 save
pm2 startup        # prints a command to run once, so pm2 starts at boot
```

`--kill-timeout 30000` matters: pm2 sends the stop signal and then kills the process after 1.6 seconds unless told
otherwise, which is too short for the bot to save games. Use `pm2 restart frotz-bot` and `pm2 logs frotz-bot` day to
day, and start `./frotz-bot.js` directly rather than through `npm`.

## Installing Node.js 22 or later (Ubuntu)

The bot needs Node.js 22.12 or later, and Ubuntu's own packages are older than that. Upgrading Node does not touch a
bot that is already running (it keeps running on the old version until you restart it), so do this before stopping it.

**1. Find out how the current node was installed.**

```sh
which -a node                                  # every node on your PATH, in the order they are found
readlink -f "$(command -v node)"               # where the first one really lives
dpkg -S "$(readlink -f "$(command -v node)")"  # names a package if it came from apt
apt-cache policy nodejs                        # which apt repository offers it (look for deb.nodesource.com)
ls -d ~/.nvm 2>/dev/null                       # exists if nvm is installed
snap list node 2>/dev/null                     # lists it if it came from snap
```

| What you see | How it was installed | Go to |
| --- | --- | --- |
| `dpkg -S` names `nodejs`, in `/usr/bin` | apt (NodeSource's repository, or Ubuntu's) | A |
| The path contains `.nvm` | nvm | B |
| `/usr/local/bin/node`, and `dpkg -S` finds nothing | a downloaded tarball, or the `n` tool | C |
| `snap list` shows `node` | snap | D |

If apt is not offering a newer node, it is usually because its repository only carries one major version: NodeSource
has a separate repository for each (20.x, 22.x, 24.x), so moving to a new major version means switching repositories.

**A. apt.** Switch to NodeSource's repository for the version you want (22 and 24 are both fine for the bot; 22 is
what it is most tested with), and install over the old one. NodeSource's setup script is a download you run as root, so
read it first if you like:

```sh
sudo apt install -y curl
curl -fsSL https://deb.nodesource.com/setup_22.x -o nodesource_setup.sh
less nodesource_setup.sh                        # optional: see what it will do
sudo -E bash nodesource_setup.sh
sudo apt install -y nodejs
node --version
```

(Use `setup_24.x` for 24.) See [NodeSource's instructions](https://github.com/nodesource/distributions) for the
current details.

If `apt-cache policy nodejs` shows a `nodesource` version that is installed but lists no NodeSource repository (the
only source for it is `/var/lib/dpkg/status`), node was installed from NodeSource once and its repository has since
gone, so apt cannot see anything newer. The same commands fix that: the setup script adds the repository again.

If node came from Ubuntu's own `nodejs` package, this is the way to get a newer one: Ubuntu does not offer Node 22,
which is why `apt upgrade` shows nothing. NodeSource's `nodejs` includes npm, so if apt stops with a message that
`nodejs` conflicts with `npm`, remove Ubuntu's separate package first (`sudo apt remove npm`) and run the install
again.

**B. nvm.**

```sh
nvm install 22
nvm alias default 22
node --version
```

nvm only loads in your own shell. A systemd service, cron, or a boot script does not see it, so those need the full
path (`which node` after `nvm use 22`, something like `/home/you/.nvm/versions/node/v22.x.y/bin/node`) and that path
changes whenever you install a new version. If you would rather not track it, install node with option A instead and
let nvm stay for your own use.

**C. `/usr/local/bin/node`.** If the `n` tool installed it (`command -v n`), `sudo n 22` replaces it. If it came from
a tarball, the simplest fix is option A **and** removing the old file: `/usr/local/bin` comes before `/usr/bin` in
`PATH`, so an old node left there keeps winning over the new one. `which -a node` shows whether that has happened.

**D. snap.** `sudo snap refresh node --channel=22/stable` (`snap info node` lists the channels it offers).

**2. Check it.** `node --version` should print 22.12 or later, and `which -a node` should show only the new one. If
the bot is started by a script or a service, make sure that is the node it uses (a service has its own `ExecStart`
path, and a screen script uses whatever is first on the PATH it runs with). Then run `npm ci` in the bot's folder again
and restart the bot.

## Updating

The interpreter, `@random-lunacy/rezrov-zmachine`, is an npm dependency, so `npm ci` installs the version recorded in
`package-lock.json`:

```sh
cd ~/discord-frotz-bot && git pull && npm ci
sudo systemctl restart frotz-bot       # or stop and start it however you run it
```

Restarting saves running games first. If a pull changes `.env.template`, add any new settings you want to your `.env`
(see [Configuration](../README.md#configuration)); the bot re-registers its slash commands every time it starts, and
Discord can take a minute to show changes.

## Upgrading from the dfrotz version

The older version ran games through the `dfrotz` program and played them in one channel. The current version runs them
inside the bot, in threads. Steps for a server running the old version:

1. **Warn players to save.** The old version cannot save for them: stopping it loses progress that wasn't saved with
   `/save`.
2. **Check Node.js.** The bot needs 22.12 or later (`node --version`). If yours is older, see
   [Installing Node.js 22 or later](#installing-nodejs-22-or-later-ubuntu).
3. **Stop the old bot.** For the `screen` script above: `screen -r FROTZ`, then Ctrl+C.
4. **Get the new code.** `npm ci` also installs the interpreter:
    ```sh
    cd ~/discord-frotz-bot && git pull && npm ci
    ```
5. **Check `.env`.** `DISCORD_TOKEN` and `GAME_FOLDER` carry over. The new optional settings (limiting channels, the
   idle timeout, thread lifetime, and so on) are in [`.env.template`](../.env.template) and the README.
6. **Check `games/games.json`.** Each game's `id` may contain only letters and numbers (it is part of save file
   names), and the games must be Z-machine versions 1 to 5 (see [Supported games](../README.md#supported-games)).
7. **Existing saves keep working.** Saves made by the old version (`<game>-<time>-<user>.qzl`) are standard Quetzal
   files and are offered by `/restore`, without a name.
8. **Give the bot's role two more permissions** in the server (Server Settings, Roles): **Create Public Threads** and
   **Send Messages in Threads**. Each game is played in its own thread. No new invite is needed, and the Message
   Content intent stays on.
9. **Start it** with systemd or the updated screen script above. If you start the bot from a crontab `@reboot` line
   today, take that line out when you switch to a service. The `/channel` command is gone and new ones appear
   after a minute; players start games with `/start` in a channel and play in the thread the bot creates.
10. `dfrotz` is no longer used and can be uninstalled.

If you set `ALLOWED_CHANNELS`, use the numeric ID of each channel, not its name.
