#define AppName "Anyattend"
#define AppVersion "1.0.0"
#define AppPublisher "Anyattend"
#define AppExeName "AnyattendProvisioner.exe"

[Setup]
AppId={{22F9A483-2D08-4B3F-BBB3-9DBA6362277F}
AppName={#AppName}
AppVersion={#AppVersion}
AppPublisher={#AppPublisher}
DefaultDirName={autopf}\Anyattend
DefaultGroupName=Anyattend
OutputBaseFilename=Anyattend-Setup
Compression=lzma
SolidCompression=yes
ArchitecturesInstallIn64BitMode=x64compatible
PrivilegesRequired=admin
WizardStyle=modern

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Files]
Source: "..\agent\publish\AnyattendAgent\*"; DestDir: "{app}\agent"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "..\agent\publish\AnyattendProvisioner\*"; DestDir: "{app}\provisioner"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "..\scripts\*.ps1"; DestDir: "{app}\scripts"; Flags: ignoreversion

[Run]
Filename: "sc.exe"; Parameters: "create AnyattendAgent binPath= ""{app}\agent\AnyattendAgent.exe"" start= auto"; Flags: runhidden
Filename: "sc.exe"; Parameters: "start AnyattendAgent"; Flags: runhidden
Filename: "{app}\provisioner\{#AppExeName}"; Description: "Run pairing wizard"; Flags: postinstall nowait skipifsilent

[UninstallRun]
Filename: "sc.exe"; Parameters: "stop AnyattendAgent"; Flags: runhidden
Filename: "sc.exe"; Parameters: "delete AnyattendAgent"; Flags: runhidden
