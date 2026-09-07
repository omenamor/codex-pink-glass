Set shell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
root = fso.GetParentFolderName(WScript.ScriptFullName)
code = shell.Run("powershell.exe -NoProfile -WindowStyle Hidden -File " & Chr(34) & root & "\Start-CodexPink.ps1" & Chr(34) & " -Remove", 0, True)
If code <> 0 Then MsgBox "Pink Glass could not finish. If no detailed error appeared, Windows may have blocked PowerShell scripts. See README; do not bypass your security policy.", 48, "Pink Glass"
