// PX2: PXE image upload, listing, deletion
// PX3: Template generation (Kickstart / Preseed / Unattend.xml)
// PX4: Deployment progress tracking
// PX5: Post-deploy hook config
// PX6: Image capture (golden image config)

use axum::{
    body::Bytes,
    extract::{Multipart, Path, State},
    http::StatusCode,
    Json,
};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use uuid::Uuid;

use crate::AppState;

const IMAGES_DIR: &str = "data/pxe/tftpboot/images";

// ============================================================================
// Models
// ============================================================================

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
/// Represents a pxe image.
pub struct PxeImage {
    pub id: Uuid,
    pub name: String,
    pub os_type: String,
    pub os_version: Option<String>,
    pub image_type: String,
    pub file_path: String,
    pub file_size: Option<i64>,
    pub file_hash: Option<String>,
    pub description: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
/// Represents a pxe deployment.
pub struct PxeDeployment {
    pub id: Uuid,
    pub asset_mac: String,
    pub profile_id: Option<Uuid>,
    pub status: String,
    pub progress: i32,
    pub current_step: Option<String>,
    pub started_at: Option<DateTime<Utc>>,
    pub completed_at: Option<DateTime<Utc>>,
    pub error_message: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

// ============================================================================
// PX2: Image management
// ============================================================================

pub async fn list_images(
    State(state): State<AppState>,
) -> Result<Json<Vec<PxeImage>>, (StatusCode, String)> {
    let images = sqlx::query_as::<_, PxeImage>(
        "SELECT id, name, os_type, os_version, image_type, file_path, file_size, file_hash, description, created_at, updated_at FROM pxe.images ORDER BY created_at DESC",
    )
    .fetch_all(state.db.inner())
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(images))
}

pub async fn upload_image(
    State(state): State<AppState>,
    mut multipart: Multipart,
) -> Result<(StatusCode, Json<PxeImage>), (StatusCode, String)> {
    tokio::fs::create_dir_all(IMAGES_DIR)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let mut file_bytes: Option<Bytes> = None;
    let mut name = String::new();
    let mut os_type = String::from("linux");
    let mut os_version: Option<String> = None;
    let mut image_type = String::from("kernel");
    let mut description: Option<String> = None;
    let mut original_filename = String::from("image.bin");

    while let Some(field) = multipart
        .next_field()
        .await
        .map_err(|e| (StatusCode::BAD_REQUEST, e.to_string()))?
    {
        let field_name = field.name().unwrap_or("").to_string();
        match field_name.as_str() {
            "file" => {
                original_filename = field.file_name().unwrap_or("image.bin").to_string();
                file_bytes = Some(
                    field
                        .bytes()
                        .await
                        .map_err(|e| (StatusCode::BAD_REQUEST, e.to_string()))?,
                );
            },
            "name" => {
                name = field
                    .text()
                    .await
                    .map_err(|e| (StatusCode::BAD_REQUEST, e.to_string()))?;
            },
            "os_type" => {
                os_type = field
                    .text()
                    .await
                    .map_err(|e| (StatusCode::BAD_REQUEST, e.to_string()))?;
            },
            "os_version" => {
                os_version = Some(
                    field
                        .text()
                        .await
                        .map_err(|e| (StatusCode::BAD_REQUEST, e.to_string()))?,
                );
            },
            "image_type" => {
                image_type = field
                    .text()
                    .await
                    .map_err(|e| (StatusCode::BAD_REQUEST, e.to_string()))?;
            },
            "description" => {
                description = Some(
                    field
                        .text()
                        .await
                        .map_err(|e| (StatusCode::BAD_REQUEST, e.to_string()))?,
                );
            },
            _ => {},
        }
    }

    let bytes = file_bytes.ok_or((
        StatusCode::BAD_REQUEST,
        "No file field in multipart".to_string(),
    ))?;
    if name.is_empty() {
        name = original_filename.clone();
    }

    let file_size = bytes.len() as i64;

    // Compute SHA-256 hash
    let hash = sha256_hex(&bytes);

    // Save to disk
    let id = Uuid::new_v4();
    let ext = std::path::Path::new(&original_filename)
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("bin");
    let stored_name = format!("{}.{}", id, ext);
    let file_path = PathBuf::from(IMAGES_DIR).join(&stored_name);
    let file_path_str = file_path.to_string_lossy().to_string();

    tokio::fs::write(&file_path, &bytes).await.map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("Failed to write file: {}", e),
        )
    })?;

    // Insert metadata
    let image = sqlx::query_as::<_, PxeImage>(
        r#"
        INSERT INTO pxe.images (name, os_type, os_version, image_type, file_path, file_size, file_hash, description)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING id, name, os_type, os_version, image_type, file_path, file_size, file_hash, description, created_at, updated_at
        "#,
    )
    .bind(&name)
    .bind(&os_type)
    .bind(&os_version)
    .bind(&image_type)
    .bind(&file_path_str)
    .bind(file_size)
    .bind(&hash)
    .bind(&description)
    .fetch_one(state.db.inner())
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok((StatusCode::CREATED, Json(image)))
}

pub async fn delete_image(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<StatusCode, (StatusCode, String)> {
    // Get file path first
    let image: Option<PxeImage> = sqlx::query_as(
        "SELECT id, name, os_type, os_version, image_type, file_path, file_size, file_hash, description, created_at, updated_at FROM pxe.images WHERE id = $1",
    )
    .bind(id)
    .fetch_optional(state.db.inner())
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let image = image.ok_or((StatusCode::NOT_FOUND, "Image not found".to_string()))?;

    // Delete from DB
    sqlx::query("DELETE FROM pxe.images WHERE id = $1")
        .bind(id)
        .execute(state.db.inner())
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    // Delete file (best effort)
    let _ = tokio::fs::remove_file(&image.file_path).await;

    Ok(StatusCode::NO_CONTENT)
}

// ============================================================================
// PX3: Template generation
// ============================================================================

#[derive(Debug, Deserialize)]
/// Request payload for GenerateTemplate operation.
pub struct GenerateTemplateRequest {
    pub os_type: String, // "rhel" | "debian" | "ubuntu" | "windows"
    pub hostname: String,
    pub domain: Option<String>,
    pub disk_layout: Option<String>, // "auto" | "lvm" | "custom"
    pub timezone: Option<String>,
    pub locale: Option<String>,
    pub packages: Option<Vec<String>>,
    pub users: Option<Vec<TemplateUser>>,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
/// Represents a template user.
pub struct TemplateUser {
    pub username: String,
    pub password_hash: Option<String>,
    pub sudo: Option<bool>,
}

#[derive(Debug, Serialize)]
/// Represents a generated template.
pub struct GeneratedTemplate {
    pub os_type: String,
    pub format: String,
    pub content: String,
}

pub async fn generate_template(
    Json(req): Json<GenerateTemplateRequest>,
) -> Result<Json<GeneratedTemplate>, (StatusCode, String)> {
    let (format, content) = match req.os_type.to_lowercase().as_str() {
        "rhel" | "centos" | "fedora" | "rocky" | "alma" => {
            ("kickstart".to_string(), generate_kickstart(&req))
        },
        "debian" | "ubuntu" => ("preseed".to_string(), generate_preseed(&req)),
        "windows" => ("unattend.xml".to_string(), generate_unattend(&req)),
        _ => {
            return Err((
                StatusCode::BAD_REQUEST,
                format!(
                    "Unsupported os_type: {}. Use rhel, centos, debian, ubuntu, or windows",
                    req.os_type
                ),
            ));
        },
    };

    Ok(Json(GeneratedTemplate {
        os_type: req.os_type,
        format,
        content,
    }))
}

fn generate_kickstart(req: &GenerateTemplateRequest) -> String {
    let timezone = req.timezone.as_deref().unwrap_or("UTC");
    let locale = req.locale.as_deref().unwrap_or("en_US.UTF-8");
    let disk_layout = req.disk_layout.as_deref().unwrap_or("auto");
    let hostname = &req.hostname;
    let domain = req.domain.as_deref().unwrap_or("localdomain");

    let disk_section = match disk_layout {
        "lvm" => {
            r#"clearpart --all --initlabel
part /boot --fstype=xfs --size=1024
part pv.01 --size=1 --grow
volgroup vg_main pv.01
logvol / --fstype=xfs --vgname=vg_main --size=10240 --name=lv_root
logvol swap --vgname=vg_main --recommended --name=lv_swap"#
        },
        _ => {
            r#"clearpart --all --initlabel
autopart --type=plain"#
        },
    };

    let packages = req
        .packages
        .as_ref()
        .map(|pkgs| pkgs.join("\n"))
        .unwrap_or_else(|| "@core\nopenssh-server".to_string());

    let users_section = req
        .users
        .as_ref()
        .map(|users| {
            users
                .iter()
                .map(|u| {
                    let sudo = if u.sudo.unwrap_or(false) {
                        " --groups=wheel"
                    } else {
                        ""
                    };
                    let passwd = u
                        .password_hash
                        .as_deref()
                        .map(|h| format!(" --iscrypted --password={}", h))
                        .unwrap_or_default();
                    format!("user --name={}{}{}", u.username, passwd, sudo)
                })
                .collect::<Vec<_>>()
                .join("\n")
        })
        .unwrap_or_default();

    format!(
        r#"# Kickstart file generated by SignApps PXE
# OS: {os_type} | Host: {hostname}.{domain}
install
cdrom
lang {locale}
keyboard us
network --bootproto=dhcp --hostname={hostname}.{domain}
rootpw --iscrypted !!
timezone {timezone} --isUtc
bootloader --location=mbr
zerombr
{disk_section}
auth --enableshadow --passalgo=sha512
selinux --enforcing
firewall --enabled --ssh
firstboot --disable
reboot

%packages
{packages}
%end

{users_section}

%post
systemctl enable sshd
%end
"#,
        os_type = "RHEL/CentOS",
        hostname = hostname,
        domain = domain,
        locale = locale,
        timezone = timezone,
        disk_section = disk_section,
        packages = packages,
        users_section = users_section,
    )
}

fn generate_preseed(req: &GenerateTemplateRequest) -> String {
    let timezone = req.timezone.as_deref().unwrap_or("UTC");
    let locale = req.locale.as_deref().unwrap_or("en_US.UTF-8");
    let hostname = &req.hostname;
    let domain = req.domain.as_deref().unwrap_or("localdomain");

    let packages = req
        .packages
        .as_ref()
        .map(|pkgs| pkgs.join(" "))
        .unwrap_or_else(|| "openssh-server curl wget".to_string());

    let first_user = req.users.as_ref().and_then(|u| u.first().cloned());

    let (user_fullname, username, user_passwd) = if let Some(u) = first_user {
        (
            u.username.clone(),
            u.username.clone(),
            u.password_hash
                .clone()
                .unwrap_or_else(|| "changeme".to_string()),
        )
    } else {
        (
            "Admin".to_string(),
            "admin".to_string(),
            "changeme".to_string(),
        )
    };

    format!(
        r#"# Preseed file generated by SignApps PXE
# OS: Debian/Ubuntu | Host: {hostname}

# Locale
d-i debian-installer/locale string {locale}
d-i keyboard-configuration/xkb-keymap select us

# Network
d-i netcfg/choose_interface select auto
d-i netcfg/get_hostname string {hostname}
d-i netcfg/get_domain string {domain}

# Mirror
d-i mirror/country string manual
d-i mirror/http/hostname string deb.debian.org
d-i mirror/http/directory string /debian
d-i mirror/http/proxy string

# Clock
d-i clock-setup/utc boolean true
d-i time/zone string {timezone}

# Partitioning
d-i partman-auto/method string regular
d-i partman-auto/choose_recipe select atomic
d-i partman/confirm_write_new_label boolean true
d-i partman/choose_partition select finish
d-i partman/confirm boolean true
d-i partman/confirm_nooverwrite boolean true

# Users
d-i passwd/root-login boolean false
d-i passwd/user-fullname string {user_fullname}
d-i passwd/username string {username}
d-i passwd/user-password password {user_passwd}
d-i passwd/user-password-again password {user_passwd}

# Packages
d-i pkgsel/include string {packages}
d-i pkgsel/upgrade select full-upgrade
popularity-contest popularity-contest/participate boolean false

# Bootloader
d-i grub-installer/only_debian boolean true
d-i grub-installer/with_other_os boolean true
d-i grub-installer/bootdev string default

# Finish
d-i finish-install/reboot_in_progress note
"#,
        hostname = hostname,
        domain = domain,
        locale = locale,
        timezone = timezone,
        packages = packages,
        user_fullname = user_fullname,
        username = username,
        user_passwd = user_passwd,
    )
}

fn generate_unattend(req: &GenerateTemplateRequest) -> String {
    let hostname = &req.hostname;
    let timezone = req.timezone.as_deref().unwrap_or("UTC");
    let locale = req.locale.as_deref().unwrap_or("en-US");

    let first_user = req.users.as_ref().and_then(|u| u.first().cloned());
    let (username, password) = if let Some(u) = first_user {
        (
            u.username,
            u.password_hash.unwrap_or_else(|| "P@ssw0rd!".to_string()),
        )
    } else {
        ("Administrator".to_string(), "P@ssw0rd!".to_string())
    };

    format!(
        r#"<?xml version="1.0" encoding="utf-8"?>
<!-- Unattend.xml generated by SignApps PXE -->
<!-- OS: Windows | Host: {hostname} -->
<unattend xmlns="urn:schemas-microsoft-com:unattend">
  <settings pass="windowsPE">
    <component name="Microsoft-Windows-International-Core-WinPE"
               processorArchitecture="amd64"
               publicKeyToken="31bf3856ad364e35" language="neutral"
               versionScope="nonSxS">
      <SetupUILanguage>
        <UILanguage>{locale}</UILanguage>
      </SetupUILanguage>
      <InputLocale>{locale}</InputLocale>
      <SystemLocale>{locale}</SystemLocale>
      <UILanguage>{locale}</UILanguage>
      <UserLocale>{locale}</UserLocale>
    </component>
    <component name="Microsoft-Windows-Setup"
               processorArchitecture="amd64"
               publicKeyToken="31bf3856ad364e35" language="neutral"
               versionScope="nonSxS">
      <DiskConfiguration>
        <Disk wcm:action="add">
          <CreatePartitions>
            <CreatePartition wcm:action="add">
              <Order>1</Order>
              <Type>Primary</Type>
              <Extend>true</Extend>
            </CreatePartition>
          </CreatePartitions>
          <DiskID>0</DiskID>
          <WillWipeDisk>true</WillWipeDisk>
        </Disk>
      </DiskConfiguration>
      <ImageInstall>
        <OSImage>
          <InstallFrom>
            <MetaData wcm:action="add">
              <Key>/IMAGE/INDEX</Key>
              <Value>1</Value>
            </MetaData>
          </InstallFrom>
          <InstallTo>
            <DiskID>0</DiskID>
            <PartitionID>1</PartitionID>
          </InstallTo>
        </OSImage>
      </ImageInstall>
      <UserData>
        <AcceptEula>true</AcceptEula>
        <FullName>{username}</FullName>
        <Organization>SignApps</Organization>
      </UserData>
    </component>
  </settings>
  <settings pass="oobeSystem">
    <component name="Microsoft-Windows-International-Core"
               processorArchitecture="amd64"
               publicKeyToken="31bf3856ad364e35" language="neutral"
               versionScope="nonSxS">
      <InputLocale>{locale}</InputLocale>
      <SystemLocale>{locale}</SystemLocale>
      <UILanguage>{locale}</UILanguage>
      <UserLocale>{locale}</UserLocale>
    </component>
    <component name="Microsoft-Windows-Shell-Setup"
               processorArchitecture="amd64"
               publicKeyToken="31bf3856ad364e35" language="neutral"
               versionScope="nonSxS">
      <ComputerName>{hostname}</ComputerName>
      <TimeZone>{timezone}</TimeZone>
      <OOBE>
        <HideEULAPage>true</HideEULAPage>
        <HideLocalAccountScreen>true</HideLocalAccountScreen>
        <HideOnlineAccountScreens>true</HideOnlineAccountScreens>
        <HideWirelessSetupInOOBE>true</HideWirelessSetupInOOBE>
        <NetworkLocation>Work</NetworkLocation>
        <ProtectYourPC>3</ProtectYourPC>
        <SkipMachineOOBE>true</SkipMachineOOBE>
        <SkipUserOOBE>true</SkipUserOOBE>
      </OOBE>
      <UserAccounts>
        <LocalAccounts>
          <LocalAccount wcm:action="add">
            <Password>
              <Value>{password}</Value>
              <PlainText>true</PlainText>
            </Password>
            <Group>Administrators</Group>
            <Name>{username}</Name>
          </LocalAccount>
        </LocalAccounts>
      </UserAccounts>
    </component>
  </settings>
</unattend>
"#,
        hostname = hostname,
        locale = locale,
        timezone = timezone,
        username = username,
        password = password,
    )
}

// ============================================================================
// PX4: Deployment progress tracking
// ============================================================================

#[derive(Debug, Deserialize)]
/// Request payload for DeploymentProgress operation.
pub struct DeploymentProgressRequest {
    pub progress: i32,
    pub current_step: Option<String>,
    pub status: Option<String>,
    pub error_message: Option<String>,
}

pub async fn update_deployment_progress(
    State(state): State<AppState>,
    Path(mac): Path<String>,
    Json(payload): Json<DeploymentProgressRequest>,
) -> Result<StatusCode, (StatusCode, String)> {
    let progress = payload.progress.clamp(0, 100);
    let status = payload.status.as_deref().unwrap_or(if progress == 100 {
        "completed"
    } else {
        "deploying"
    });

    let now = Utc::now();
    let started_at = if status == "deploying" && progress == 1 {
        Some(now)
    } else {
        None
    };
    let completed_at = if progress == 100 { Some(now) } else { None };

    // Upsert: create or update the deployment record for this MAC
    sqlx::query(
        r#"
        INSERT INTO pxe.deployments (asset_mac, status, progress, current_step, started_at, completed_at, error_message, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
        ON CONFLICT (asset_mac) DO UPDATE SET
            status        = EXCLUDED.status,
            progress      = EXCLUDED.progress,
            current_step  = COALESCE(EXCLUDED.current_step, pxe.deployments.current_step),
            started_at    = COALESCE(pxe.deployments.started_at, EXCLUDED.started_at),
            completed_at  = COALESCE(EXCLUDED.completed_at, pxe.deployments.completed_at),
            error_message = COALESCE(EXCLUDED.error_message, pxe.deployments.error_message),
            updated_at    = NOW()
        "#,
    )
    .bind(&mac)
    .bind(status)
    .bind(progress)
    .bind(&payload.current_step)
    .bind(started_at)
    .bind(completed_at)
    .bind(&payload.error_message)
    .execute(state.db.inner())
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(StatusCode::NO_CONTENT)
}

pub async fn list_deployments(
    State(state): State<AppState>,
) -> Result<Json<Vec<PxeDeployment>>, (StatusCode, String)> {
    let deployments = sqlx::query_as::<_, PxeDeployment>(
        "SELECT id, asset_mac, profile_id, status, progress, current_step, started_at, completed_at, error_message, created_at, updated_at FROM pxe.deployments ORDER BY updated_at DESC",
    )
    .fetch_all(state.db.inner())
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(deployments))
}

// ============================================================================
// PX5: Post-deploy hook config stored in profile metadata
// ============================================================================

#[derive(Debug, Deserialize, Serialize)]
/// Represents a post deploy hooks.
pub struct PostDeployHooks {
    pub run_scripts: Vec<String>,
    pub install_packages: Vec<String>,
    pub join_domain: Option<DomainJoinConfig>,
    pub notify_webhook: Option<String>,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
/// Configuration for DomainJoin.
pub struct DomainJoinConfig {
    pub domain: String,
    pub ou: Option<String>,
    pub credential_ref: Option<String>,
}

pub async fn get_profile_hooks(
    State(state): State<AppState>,
    Path(profile_id): Path<Uuid>,
) -> Result<Json<PostDeployHooks>, (StatusCode, String)> {
    let row: Option<(Option<serde_json::Value>,)> =
        sqlx::query_as("SELECT post_deploy_hooks FROM pxe.profiles WHERE id = $1")
            .bind(profile_id)
            .fetch_optional(state.db.inner())
            .await
            .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let (hooks_json,) = row.ok_or((StatusCode::NOT_FOUND, "Profile not found".to_string()))?;

    let hooks: PostDeployHooks = match hooks_json {
        Some(v) => serde_json::from_value(v).unwrap_or(PostDeployHooks {
            run_scripts: vec![],
            install_packages: vec![],
            join_domain: None,
            notify_webhook: None,
        }),
        None => PostDeployHooks {
            run_scripts: vec![],
            install_packages: vec![],
            join_domain: None,
            notify_webhook: None,
        },
    };

    Ok(Json(hooks))
}

pub async fn update_profile_hooks(
    State(state): State<AppState>,
    Path(profile_id): Path<Uuid>,
    Json(hooks): Json<PostDeployHooks>,
) -> Result<StatusCode, (StatusCode, String)> {
    let hooks_value = serde_json::to_value(&hooks)
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let result = sqlx::query(
        "UPDATE pxe.profiles SET post_deploy_hooks = $1, updated_at = NOW() WHERE id = $2",
    )
    .bind(hooks_value)
    .bind(profile_id)
    .execute(state.db.inner())
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    if result.rows_affected() == 0 {
        return Err((StatusCode::NOT_FOUND, "Profile not found".to_string()));
    }
    Ok(StatusCode::NO_CONTENT)
}

// ============================================================================
// PX6: Golden image capture (config-only — stores metadata)
// ============================================================================

#[derive(Debug, Deserialize, Serialize)]
/// Request payload for CaptureImage operation.
pub struct CaptureImageRequest {
    pub source_mac: String,
    pub name: String,
    pub os_type: String,
    pub os_version: Option<String>,
    pub description: Option<String>,
    pub capture_tool: Option<String>, // "clonezilla" | "fog" | "custom"
}

#[derive(Debug, Serialize)]
/// Response payload for CaptureImage operation.
pub struct CaptureImageResponse {
    pub capture_id: Uuid,
    pub name: String,
    pub status: String,
    pub instructions: String,
}

pub async fn capture_golden_image(
    State(_state): State<AppState>,
    Json(req): Json<CaptureImageRequest>,
) -> Result<(StatusCode, Json<CaptureImageResponse>), (StatusCode, String)> {
    let capture_id = Uuid::new_v4();
    let tool = req.capture_tool.as_deref().unwrap_or("clonezilla");

    let instructions = match tool {
        "clonezilla" => format!(
            "Boot {} from Clonezilla live USB. Run: clonezilla -x -d /dev/sda -r images/{} -z1p",
            req.source_mac, capture_id
        ),
        "fog" => format!(
            "Register MAC {} in FOG server and assign capture task for image '{}'",
            req.source_mac, req.name
        ),
        _ => format!(
            "Custom capture: dd if=/dev/sda bs=4M | gzip > images/{}.gz then upload to /api/v1/pxe/images/upload",
            capture_id
        ),
    };

    Ok((
        StatusCode::ACCEPTED,
        Json(CaptureImageResponse {
            capture_id,
            name: req.name,
            status: "capture_configured".to_string(),
            instructions,
        }),
    ))
}

// ============================================================================
// Utility
// ============================================================================

fn sha256_hex(data: &[u8]) -> String {
    use sha2::{Digest, Sha256};
    let mut hasher = Sha256::new();
    hasher.update(data);
    format!("{:x}", hasher.finalize())
}
