# Windows setup builder

This builds the ordinary per-user Windows installer for **Codex Custom Themes for Windows**. The installer consumes the plugin payload unchanged and includes Node.js; users do not need Node, Codex developer tools, or administrator rights to install it. The official Codex Windows application remains a prerequisite.

```powershell
.\installer\prepare-build-tools.ps1
.\installer\build-installer.ps1 -PluginPath .\plugins\pink-glass -LicensePath .\LICENSE
.\installer\test-installer.ps1 -InstallerPath .\installer\out\Codex-Custom-Themes-Windows-Setup-0.11.0.exe
```

The compiler helper downloads **Inno Setup 6.4.3** from its [official release](https://github.com/jrsoftware/issrc/releases/tag/is-6_4_3), verifies the pinned SHA256 and publisher signature, and installs it for the current user beneath `installer/tools`. That version's included license explicitly permits commercial and noncommercial use. The compiler is only a build dependency; its license is included in the application package. Node's license remains in `payload/runtime/LICENSE.txt`.

By default, setup installs to `%LOCALAPPDATA%\Programs\CodexCustomThemes`, adds a Start Menu launcher and an optional desktop shortcut, and registers a Windows uninstall entry. It does not launch or restart Codex during setup. Each build has its own immutable `versions/<version>-<content-hash>` directory, and updates retain an already-running version until Codex closes normally. The shortcut uses a wrapper that resolves the real filesystem path and displays useful startup errors without bypassing PowerShell security policy. A named per-user launch lock and the existing connector checks prevent duplicate starts.

The uninstaller refuses to run while this installation's connector is active. It removes only files recorded by the installer and leaves unregistered files alone. Saved Pink Glass profiles and imported images live in the user's Codex profile and are never reset or deleted by the installer. The underlying `pink-glass` package identifier and storage keys stay compatible.

The setup is unsigned. Release checksums identify the published artifact. No signing credential is bundled or required to build it. The launcher uses local PowerShell scripts under the user's existing execution policy. A Windows installation or organization policy that blocks those scripts can allow setup to finish while blocking launch; the wrapper reports the failure instead of silently doing nothing. Setup and the launcher do not change or bypass execution policy. Installation QA was run under `RemoteSigned`, not under a fresh Windows `Restricted` policy.

`test-installer.ps1` performs installation in a unique local QA directory with `/TESTINSTALL=1`, which suppresses real desktop/Start Menu shortcuts and uninstall registration. It verifies every bundled package checksum, same-version reinstall, damaged-file refusal, active-connector uninstall refusal, removal of installed files, and preservation of an unrelated user file. `-UpgradeInstallerPath <new-setup.exe>` additionally checks two-version upgrades and uninstall. Logs remain under `installer/qa` for inspection. Tests do not connect to or restart Codex.

Build outputs (`out`, `stage`), downloaded tools, and QA files are excluded from source control. Publish the `.exe` and adjacent `.sha256` as release assets. Copy only the source files in this directory when staging the public repository.
