; Inno Setup Script для MurFlame Launcher

#define MyAppName "MurFlame Launcher"
#define MyAppVersion "03.06.26"
#define MyAppPublisher "MurFlame"
#define MyAppURL "https://github.com/murflame"
#define MyAppExeName "MurFlame Launcher.exe"

[Setup]
AppId={{8E5B8E5A-8E5B-8E5B-8E5B-8E5B8E5B8E5B}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppVerName={#MyAppName} {#MyAppVersion}
AppPublisher={#MyAppPublisher}
AppPublisherURL={#MyAppURL}
AppSupportURL={#MyAppURL}
AppUpdatesURL={#MyAppURL}
DefaultDirName={autopf}\{#MyAppName}
DefaultGroupName={#MyAppName}
AllowNoIcons=yes
LicenseFile=LICENSE.txt
PrivilegesRequired=lowest
OutputDir=installer
OutputBaseFilename=MurFlame_Setup_{#MyAppVersion}
SetupIconFile=assets\icon.ico
UninstallDisplayIcon={app}\{#MyAppExeName}
Compression=lzma2
SolidCompression=yes
WizardStyle=modern
WizardSizePercent=100,150
ShowLanguageDialog=yes
Uninstallable=yes
CreateUninstallRegKey=yes
DisableProgramGroupPage=yes
UsePreviousAppDir=yes
ArchitecturesInstallIn64BitMode=x64
ArchitecturesAllowed=x64

[Languages]
Name: "russian"; MessagesFile: "compiler:Languages\Russian.isl"
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"; Flags: unchecked

[Files]
Source: "release\win-unpacked\{#MyAppExeName}"; DestDir: "{app}"; Flags: ignoreversion
Source: "release\win-unpacked\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "assets\icon.ico"; DestDir: "{app}"; Flags: ignoreversion

[Icons]
Name: "{group}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"
Name: "{autodesktop}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; Tasks: desktopicon

[Run]
Filename: "{app}\{#MyAppExeName}"; Description: "{cm:LaunchProgram,{#StringChange(MyAppName, '&', '&&')}}"; Flags: nowait postinstall skipifsilent

[Registry]
Root: "HKCU"; Subkey: "Software\MurFlame\Launcher"; ValueType: string; ValueName: "InstallPath"; ValueData: "{app}"; Flags: uninsdeletevalue

[Code]
procedure InitializeWizard();
begin
  WizardForm.WelcomeLabel2.Caption := 'Добро пожаловать в установку MurFlame Launcher!' + #13#10 + 
                                       #13#10 + 
                                       'Этот мастер установит MurFlame Launcher на ваш компьютер.' + #13#10 +
                                       'Лаунчер автоматически скачает необходимую Java и поддержку модов.';
end;