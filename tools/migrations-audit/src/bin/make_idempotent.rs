//! Rewrites a directory of migration SQL files to make them idempotent.
//!
//! Usage: migrations-audit-rewrite <dir> [--check]
//!
//! --check: only print which files would change, exit 1 if any would.

use std::fs;
use std::io::Write;
use std::path::PathBuf;

use fancy_regex::Regex;
use walkdir::WalkDir;

fn main() {
    let dir = std::env::args()
        .nth(1)
        .expect("usage: migrations-audit-rewrite <dir> [--check]");
    let check_only = std::env::args().any(|a| a == "--check");

    let table = Regex::new(r"(?im)^(\s*CREATE\s+)TABLE\s+(?!IF\s+NOT\s+EXISTS)").unwrap();
    let index = Regex::new(r"(?im)^(\s*CREATE\s+)((?:UNIQUE\s+)?)INDEX\s+(?!IF\s+NOT\s+EXISTS)").unwrap();
    let constraint = Regex::new(
        r"(?im)^(\s*ALTER\s+TABLE\s+\S+\s+ADD\s+CONSTRAINT\s+)(?!IF\s+NOT\s+EXISTS)",
    )
    .unwrap();
    let type_re = Regex::new(r"(?im)^(\s*)CREATE\s+TYPE\s+(\S+)\s+AS\s+ENUM\s*\(([^;]+)\)\s*;").unwrap();

    let mut changed = 0usize;
    for entry in WalkDir::new(&dir)
        .into_iter()
        .filter_map(|e| e.ok())
        .filter(|e| e.path().extension().and_then(|s| s.to_str()) == Some("sql"))
    {
        let path: PathBuf = entry.path().into();
        let original = fs::read_to_string(&path).unwrap_or_default();
        let mut text = original.clone();

        text = table.replace_all(&text, "${1}TABLE IF NOT EXISTS ").to_string();
        text = index.replace_all(&text, "${1}${2}INDEX IF NOT EXISTS ").to_string();
        text = constraint.replace_all(&text, "${1}IF NOT EXISTS ").to_string();
        text = type_re
            .replace_all(
                &text,
                "${1}DO $$$$ BEGIN CREATE TYPE ${2} AS ENUM (${3}); EXCEPTION WHEN duplicate_object THEN NULL; END $$$$;",
            )
            .to_string();

        if text != original {
            changed += 1;
            if check_only {
                println!("would change: {}", path.display());
            } else {
                fs::File::create(&path)
                    .and_then(|mut f| f.write_all(text.as_bytes()))
                    .expect("write file");
                println!("rewrote: {}", path.display());
            }
        }
    }

    println!("\n{} file(s) {}", changed, if check_only { "would change" } else { "changed" });
    if check_only && changed > 0 {
        std::process::exit(1);
    }
}
