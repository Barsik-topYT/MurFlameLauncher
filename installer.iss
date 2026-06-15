[Setup]
AppName=MurFlame Launcher
AppVersion=15.06.26
DefaultDirName={autopf}\MurFlame Launcher
DefaultGroupName=MurFlame
OutputDir=release
OutputBaseFilename=MurFlame_Launcher_Setup
SetupIconFile=assets\icon.ico
LicenseFile=LICENSE.txt          ; <--- Добавьте эту строку
Compression=lzma2
SolidCompression=yes
PrivilegesRequired=lowest
UninstallDisplayIcon={app}\MurFlame Launcher.exe
UninstallDisplayName=MurFlame Launcher

[Tasks]
Name: "desktopicon"; Description: "Create desktop icon"; GroupDescription: "Additional icons:"
Name: "startmenuicon"; Description: "Create start menu icon"; GroupDescription: "Additional icons:"

[Files]
Source: "release\win-unpacked\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{group}\MurFlame Launcher"; Filename: "{app}\MurFlame Launcher.exe"
Name: "{group}\Uninstall MurFlame Launcher"; Filename: "{uninstallexe}"
Name: "{autodesktop}\MurFlame Launcher"; Filename: "{app}\MurFlame Launcher.exe"; Tasks: desktopicon

[Run]
Filename: "{app}\MurFlame Launcher.exe"; Description: "Launch MurFlame Launcher"; Flags: nowait postinstall skipifsilent

[UninstallDelete]
Type: filesandordirs; Name: "{app}"