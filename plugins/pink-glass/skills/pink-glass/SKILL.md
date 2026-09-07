---
name: pink-glass
description: Install, enable, disable and customize the Pink Glass visual mod for Codex on Windows, including Sakura, Lavender, Moonlight, Peach and Mint themes. Use when the user asks to manage this mod or its appearance.
---

# Pink Glass

This plugin packages a local visual mod. Installing the plugin does not itself change the host UI. A Windows launcher connects the bundled renderer through a loopback Codex debugging port. No account keys, model API, or external service is required. Do not describe this as an official native theme API.

Resolve the plugin root as two directories above this SKILL.md directory. Run its `scripts/PinkGlass.ps1` with PowerShell using the actual absolute path. Do not use paths from the developer's machine.

Commands:

- `-Action Status`: read active renderer version/theme and connection status.
- `-Action Install`: verify package hashes, copy runtime to LOCALAPPDATA/PinkGlassPlugin/version-packageHash, and create/update the desktop `Codex Pink Glass` shortcut without starting or closing Codex. It prints verified physical paths that also work outside the packaged app.
- `-Action Enable`: install runtime if needed, then connect or launch Codex. If Codex is already open without debugging, tell the user to finish tasks and fully close Codex, then run the printed `Codex Pink.vbs` launcher. Never force close Codex or claim the mod is active from launcher output alone; verify Status.
- `-Action Disable`: stop this installation's connector and remove injected styles. Settings are retained. Verify Status afterward. A normal restart of Codex also ends the debugging connection.
- `-Action Editor`: open the existing theme editor without changing settings.
- `-Action Theme -Theme sakura|lavender|moonlight|peach|mint`: select and save a preset; inspect the returned status for save errors. This preserves each preset's saved customizations. Never clear localStorage or reset profiles without a user request.

Use Status before changes. If another installation's connector is active, do not launch a competing connector or kill unrelated Node processes. Explain which original launcher needs to disable it, or inspect the verified original mod installation to perform an explicitly requested migration.

For installation requests, run Install and Enable and verify Status when possible. Installation cannot silently restart the running conversation. Give the exact launcher path printed by Install/Enable if a normal restart is needed, or point to the desktop `Codex Pink Glass` shortcut. Never construct a LOCALAPPDATA path yourself: Windows can redirect it into the Codex package's LocalCache, making the logical path inaccessible from Explorer. Runtime folders include a package hash so an installer update never overwrites a running runtime. If a prior package is still active after updating, leave it running; the new desktop shortcut applies on the next normal restart.

For detailed colors, opacity, backgrounds or sizes, open Editor so the user can adjust the existing controls. Do not invent unsupported command parameters. Never inspect chats to manage a theme.

Before uninstalling this plugin, run Disable if the user requests removal of the active theme. Removing the plugin alone does not stop an already running external connector or delete the retained runtime/settings. Runtime files can be removed later after stopping their connector; never recursively delete computed paths without validating the target.
