Option Explicit
Dim shell, fso, root, command, result
Set shell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
root = fso.GetParentFolderName(WScript.ScriptFullName)
command = Chr(34) & shell.ExpandEnvironmentStrings("%WINDIR%") & "\System32\WindowsPowerShell\v1.0\powershell.exe" & Chr(34) & " -NoProfile -NonInteractive -WindowStyle Hidden -File " & Chr(34) & root & "\Launch-Theme.ps1" & Chr(34)
result = shell.Run(command, 0, True)
If result <> 0 And result <> 10 Then
  MsgBox "Codex Custom Themes for Windows could not start. Windows may have blocked PowerShell scripts before the launcher could show an error. See the installed README or the project's GitHub instructions. Your security policy was not changed.", 48, "Codex Custom Themes for Windows"
End If
