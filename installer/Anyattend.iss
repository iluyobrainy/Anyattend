#define AppName "Anyattend"
#define AppVersion "1.1.0"
#define AppPublisher "Anyattend"
#define ProvisionerExe "AnyattendProvisioner.exe"

[Setup]
AppId={{22F9A483-2D08-4B3F-BBB3-9DBA6362277F}
AppName={#AppName}
AppVersion={#AppVersion}
AppPublisher={#AppPublisher}
AppPublisherURL=https://anyattend.vercel.app
AppSupportURL=https://anyattend.vercel.app
AppUpdatesURL=https://anyattend.vercel.app
DefaultDirName={autopf}\Anyattend
DefaultGroupName=Anyattend
UninstallDisplayName=Anyattend
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
Filename: "{app}\provisioner\{#ProvisionerExe}"; Parameters: "--backend-url ""{code:GetBackendUrl}"" --anydesk-id ""{code:GetAnyDeskId}"" --ownership-code ""{code:GetOwnershipCode}"" --device-label ""{code:GetDeviceLabel}"""; Description: "Apply Anyattend pairing configuration"; Flags: postinstall waituntilterminated skipifsilent
Filename: "sc.exe"; Parameters: "query AnyattendAgent"; Description: "Verify AnyattendAgent service status"; Flags: postinstall waituntilterminated skipifsilent runhidden
Filename: "https://anyattend-admin.vercel.app"; Description: "Open Admin Web App"; Flags: postinstall shellexec skipifsilent

[UninstallRun]
Filename: "sc.exe"; Parameters: "stop AnyattendAgent"; Flags: runhidden
Filename: "sc.exe"; Parameters: "delete AnyattendAgent"; Flags: runhidden

[UninstallDelete]
Type: filesandordirs; Name: "{commonappdata}\Anyattend"

[Code]
var
  BackendUrlPage: TInputQueryWizardPage;
  AnyDeskPage: TInputQueryWizardPage;
  OwnershipPage: TInputQueryWizardPage;
  DevicePage: TInputQueryWizardPage;

procedure InitializeWizard;
begin
  BackendUrlPage := CreateInputQueryPage(
    wpWelcome,
    'Backend Connection',
    'Enter your Anyattend backend URL',
    'Use your production backend endpoint. Example: https://backend-production-1497.up.railway.app'
  );
  BackendUrlPage.Add('Backend URL:', False);
  BackendUrlPage.Values[0] := 'https://backend-production-1497.up.railway.app';

  AnyDeskPage := CreateInputQueryPage(
    BackendUrlPage.ID,
    'AnyDesk Identity',
    'Enter the connectee AnyDesk ID',
    'Spaces are allowed (example: 806 716 144).'
  );
  AnyDeskPage.Add('AnyDesk ID:', False);
  AnyDeskPage.Values[0] := '';

  OwnershipPage := CreateInputQueryPage(
    AnyDeskPage.ID,
    'Ownership Challenge',
    'Enter the 6-digit ownership challenge code',
    'Generate this in Anyattend Admin PWA before installation.'
  );
  OwnershipPage.Add('Challenge code:', False);
  OwnershipPage.Values[0] := '';

  DevicePage := CreateInputQueryPage(
    OwnershipPage.ID,
    'Device Label',
    'Set a label for this laptop',
    'This label appears in the Anyattend admin dashboard.'
  );
  DevicePage.Add('Device label:', False);
  DevicePage.Values[0] := ExpandConstant('{computername}');
end;

function DigitsOnly(Value: String): String;
var
  I: Integer;
begin
  Result := '';
  for I := 1 to Length(Value) do
  begin
    if (Value[I] >= '0') and (Value[I] <= '9') then
    begin
      Result := Result + Value[I];
    end;
  end;
end;

function NextButtonClick(CurPageID: Integer): Boolean;
var
  IdDigits: String;
  ChallengeDigits: String;
begin
  Result := True;

  if CurPageID = BackendUrlPage.ID then
  begin
    if Pos('http', LowerCase(Trim(BackendUrlPage.Values[0]))) <> 1 then
    begin
      MsgBox('Backend URL must start with http:// or https://', mbError, MB_OK);
      Result := False;
      exit;
    end;
  end;

  if CurPageID = AnyDeskPage.ID then
  begin
    IdDigits := DigitsOnly(AnyDeskPage.Values[0]);
    if (Length(IdDigits) < 9) or (Length(IdDigits) > 10) then
    begin
      MsgBox('AnyDesk ID must be 9 or 10 digits.', mbError, MB_OK);
      Result := False;
      exit;
    end;
    AnyDeskPage.Values[0] := IdDigits;
  end;

  if CurPageID = OwnershipPage.ID then
  begin
    ChallengeDigits := DigitsOnly(OwnershipPage.Values[0]);
    if Length(ChallengeDigits) <> 6 then
    begin
      MsgBox('Ownership challenge code must be 6 digits.', mbError, MB_OK);
      Result := False;
      exit;
    end;
    OwnershipPage.Values[0] := ChallengeDigits;
  end;
end;

function GetBackendUrl(Value: String): String;
begin
  Result := Trim(BackendUrlPage.Values[0]);
end;

function GetAnyDeskId(Value: String): String;
begin
  Result := DigitsOnly(AnyDeskPage.Values[0]);
end;

function GetOwnershipCode(Value: String): String;
begin
  Result := DigitsOnly(OwnershipPage.Values[0]);
end;

function GetDeviceLabel(Value: String): String;
begin
  Result := Trim(DevicePage.Values[0]);
  if Result = '' then
  begin
    Result := ExpandConstant('{computername}');
  end;
end;
