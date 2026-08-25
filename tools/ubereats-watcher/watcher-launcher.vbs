Set shell = CreateObject("WScript.Shell")
shell.Run Chr(34) & CreateObject("Scripting.FileSystemObject").BuildPath(CreateObject("Scripting.FileSystemObject").GetParentFolderName(WScript.ScriptFullName), "ubereats-hub-watcher.cmd") & Chr(34), 0, False
