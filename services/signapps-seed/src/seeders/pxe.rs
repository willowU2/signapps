//! PXE seeder — 5 boot profiles + 20 enrolled assets bound to Nexus users
//! (MACs simulated as aa:bb:cc:00:00:0x..).

use crate::context::SeedContext;
use crate::seeder::{SeedReport, Seeder};
use crate::seeders::org::{bump, PERSONS};
use crate::uuid::acme_uuid;
use async_trait::async_trait;

/// Seeds 5 PXE boot profiles and 20 enrolled PXE assets.
pub struct PxeSeeder;

#[async_trait]
impl Seeder for PxeSeeder {
    fn name(&self) -> &'static str {
        "pxe"
    }

    fn dependencies(&self) -> Vec<&'static str> {
        vec!["identity"]
    }

    async fn run(&self, ctx: &SeedContext) -> anyhow::Result<SeedReport> {
        let mut report = SeedReport::default();
        let pool = ctx.db.inner();

        let profiles: &[(&str, &str, &str, &str, &str)] = &[
            (
                "ubuntu-24.04-server",
                "Ubuntu Server 24.04",
                "linux",
                "24.04",
                "#!ipxe\nkernel http://{{tftp}}/ubuntu-24.04/vmlinuz\ninitrd http://{{tftp}}/ubuntu-24.04/initrd\nboot",
            ),
            (
                "debian-12",
                "Debian 12 Bookworm",
                "linux",
                "12",
                "#!ipxe\nkernel http://{{tftp}}/debian-12/linux\ninitrd http://{{tftp}}/debian-12/initrd.gz\nboot",
            ),
            (
                "windows-pe-11",
                "Windows PE 11",
                "windows",
                "11",
                "#!ipxe\nkernel http://{{tftp}}/winpe/wimboot\ninitrd http://{{tftp}}/winpe/boot.wim\nboot",
            ),
            (
                "clonezilla",
                "Clonezilla Live",
                "linux",
                "3.1",
                "#!ipxe\nkernel http://{{tftp}}/clonezilla/vmlinuz boot=live\ninitrd http://{{tftp}}/clonezilla/initrd.img\nboot",
            ),
            (
                "memtest86",
                "Memtest86+",
                "tool",
                "7.0",
                "#!ipxe\nkernel http://{{tftp}}/memtest/mt86plus\nboot",
            ),
        ];

        for (slug, name, os_type, os_version, script) in profiles.iter() {
            let pid = acme_uuid("pxe-profile", slug);
            let res = sqlx::query(
                r#"
                INSERT INTO pxe.profiles (id, name, description, boot_script, os_type, os_version)
                VALUES ($1, $2, $3, $4, $5, $6)
                ON CONFLICT (id) DO NOTHING
                "#,
            )
            .bind(pid)
            .bind(name)
            .bind(format!("Profile démo {}", name))
            .bind(script)
            .bind(os_type)
            .bind(os_version)
            .execute(pool)
            .await;
            bump(&mut report, res, "pxe-profile");
        }

        // 20 enrolled assets — MACs aa:bb:cc:00:00:01 → aa:bb:cc:00:00:14
        // Each asset is linked to one of the first 20 PERSONS with a rotating
        // profile.
        let profile_rotation = [
            "ubuntu-24.04-server",
            "debian-12",
            "windows-pe-11",
            "clonezilla",
            "memtest86",
        ];
        let n_persons = PERSONS.len();

        for i in 0..20usize {
            let mac = format!("aa:bb:cc:00:00:{:02x}", i + 1);
            let username = PERSONS[i % n_persons].0;
            let hostname = format!("poste-{}", username.replace('.', "-"));
            let profile_slug = profile_rotation[i % profile_rotation.len()];

            let user_id = ctx
                .user(username)
                .ok_or_else(|| anyhow::anyhow!("user not registered: {}", username))?;
            let profile_id = acme_uuid("pxe-profile", profile_slug);
            let asset_id = acme_uuid("pxe-asset", &mac);

            let res = sqlx::query(
                r#"
                INSERT INTO pxe.assets
                    (id, mac_address, hostname, status, profile_id, assigned_user_id, discovered_via)
                VALUES ($1, $2, $3, 'enrolled', $4, $5, 'import')
                ON CONFLICT (mac_address) DO NOTHING
                "#,
            )
            .bind(asset_id)
            .bind(&mac)
            .bind(&hostname)
            .bind(profile_id)
            .bind(user_id)
            .execute(pool)
            .await;
            bump(&mut report, res, "pxe-asset");
        }
        Ok(report)
    }
}
