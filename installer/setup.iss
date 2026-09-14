#ifndef StageDir
  #error Build with build-installer.ps1
#endif
#define ProductName "Codex Custom Themes for Windows"
[Setup]
AppId=CodexCustomThemesForWindows
AppName={#ProductName}
AppVersion={#ProductVersion}
AppVerName={#ProductName} {#ProductVersion}
AppPublisher=omenamor
AppPublisherURL=https://github.com/omenamor/codex-pink-glass
AppSupportURL=https://github.com/omenamor/codex-pink-glass/issues
AppUpdatesURL=https://github.com/omenamor/codex-pink-glass/releases/latest
DefaultDirName={localappdata}\Programs\CodexCustomThemes
DefaultGroupName={#ProductName}
DisableProgramGroupPage=yes
DisableWelcomePage=no
PrivilegesRequired=lowest
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
MinVersion=10.0
WizardStyle=modern
OutputDir={#OutputDir}
OutputBaseFilename=Codex-Custom-Themes-Windows-Setup-{#ProductVersion}
Compression=lzma2/normal
SolidCompression=yes
SetupLogging=yes
CloseApplications=no
RestartApplications=no
UninstallDisplayName={#ProductName}
UninstallDisplayIcon={code:PhysicalIcon}
SetupIconFile={#StageDir}\app.ico
Uninstallable=yes
CreateUninstallRegKey=not IsTestInstall
LicenseFile={#StageDir}\LICENSE.txt
InfoAfterFile={#StageDir}\WELCOME.txt

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"
Name: "russian"; MessagesFile: "compiler:Languages\Russian.isl"

[Tasks]
Name: desktopicon; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"

[Files]
#include "files.iss"

[Icons]
Name: "{group}\{#ProductName}"; Filename: "{sys}\wscript.exe"; Parameters: """{code:PhysicalLauncher}"""; WorkingDir: "{code:PhysicalWorkingDir}"; IconFilename: "{code:PhysicalIcon}"; Check: not IsTestInstall
Name: "{group}\Uninstall {#ProductName}"; Filename: "{uninstallexe}"; Check: not IsTestInstall
Name: "{autodesktop}\{#ProductName}"; Filename: "{sys}\wscript.exe"; Parameters: """{code:PhysicalLauncher}"""; WorkingDir: "{code:PhysicalWorkingDir}"; IconFilename: "{code:PhysicalIcon}"; Tasks: desktopicon; Check: not IsTestInstall

[Code]
function GetFinalPathNameByHandle(Handle: THandle; Path: String; Length: Cardinal; Flags: Cardinal): Cardinal;
  external 'GetFinalPathNameByHandleW@kernel32.dll stdcall';

function PhysicalFile(const Path: String): String;
var
  Stream: TFileStream;
  Buffer: String;
  Size: Cardinal;
begin
  Stream := TFileStream.Create(Path, fmOpenRead or fmShareDenyNone);
  try
    SetLength(Buffer, 32768);
    Size := GetFinalPathNameByHandle(Stream.Handle, Buffer, 32768, 0);
    if (Size = 0) or (Size >= 32768) then RaiseException('Could not resolve the physical installation path.');
    SetLength(Buffer, Size);
    if Pos('\\?\UNC\', Buffer) = 1 then Buffer := '\\' + Copy(Buffer, 9, Length(Buffer));
    if Pos('\\?\', Buffer) = 1 then Buffer := Copy(Buffer, 5, Length(Buffer));
    Result := Buffer;
  finally
    Stream.Free;
  end;
end;

function PhysicalLauncher(Param: String): String;
begin
  Result := PhysicalFile(ExpandConstant('{app}\versions\{#VersionId}\Launch-Theme.vbs'));
end;

function PhysicalWorkingDir(Param: String): String;
begin
  Result := ExtractFileDir(PhysicalLauncher(''));
end;

function PhysicalIcon(Param: String): String;
begin
  Result := PhysicalFile(ExpandConstant('{app}\versions\{#VersionId}\app.ico'));
end;

function IsTestInstall: Boolean;
begin
  Result := ExpandConstant('{param:TESTINSTALL|0}') = '1';
end;

function HasOwnRunningConnector: Boolean;
var
  Locator, Services, Processes, Item: Variant;
  I: Integer;
  ExecutablePath, CommandLine, Prefix: String;
begin
  Result := False;
  Prefix := Lowercase(AddBackslash(ExpandConstant('{app}')) + 'versions\');
  try
    Prefix := Lowercase(AddBackslash(ExtractFileDir(PhysicalFile(ExpandConstant('{uninstallexe}')))) + 'versions\');
    Locator := CreateOleObject('WbemScripting.SWbemLocator');
    Services := Locator.ConnectServer('', 'root\CIMV2');
    Processes := Services.ExecQuery('SELECT ExecutablePath, CommandLine FROM Win32_Process WHERE Name=''node.exe''');
    for I := 0 to Processes.Count - 1 do begin
      Item := Processes.ItemIndex(I);
      if not VarIsNull(Item.ExecutablePath) and not VarIsNull(Item.CommandLine) then begin
        ExecutablePath := Item.ExecutablePath;
        CommandLine := Item.CommandLine;
        ExecutablePath := Lowercase(ExecutablePath);
        CommandLine := Lowercase(CommandLine);
        if (Pos(Prefix, ExecutablePath) = 1) and (Pos('connector.mjs', CommandLine) > 0) then Result := True;
      end;
    end;
  except
    { Fail closed: never uninstall a possibly active runtime if process inspection fails. }
    Result := True;
  end;
end;

function InitializeUninstall: Boolean;
begin
  Result := not HasOwnRunningConnector;
  if not Result and not UninstallSilent then
    MsgBox('Close Codex normally before uninstalling. No application will be closed automatically. Your saved theme settings and imported images will be kept.', mbInformation, MB_OK);
end;

procedure CurStepChanged(CurStep: TSetupStep);
begin
  if CurStep = ssPostInstall then begin
    Log('Verified physical launcher: ' + PhysicalLauncher(''));
    Log('Verified physical icon: ' + PhysicalIcon(''));
  end;
end;

function PrepareToInstall(var NeedsRestart: Boolean): String;
begin
  Result := '';
  { Version directories are immutable. A damaged same-version installation is never overwritten. }
  #include "verify.iss"
end;
