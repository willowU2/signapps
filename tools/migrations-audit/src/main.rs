//! Audit tool that flags every non-idempotent DDL statement in a
//! migrations directory.
//!
//! Idempotent forms to look for:
//!   CREATE TABLE IF NOT EXISTS
//!   CREATE [UNIQUE] INDEX IF NOT EXISTS
//!   ALTER TABLE … ADD CONSTRAINT IF NOT EXISTS (Postgres 17+)
//!   DO $$ BEGIN CREATE TYPE t AS ENUM (…); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

use std::fs;
use std::path::PathBuf;

use fancy_regex::Regex;
use walkdir::WalkDir;

fn main() {
    let dir = std::env::args()
        .nth(1)
        .expect("usage: migrations-audit <dir>");

    let patterns = [
        (
            "CREATE TABLE without IF NOT EXISTS",
            Regex::new(r"(?im)^\s*CREATE\s+TABLE\s+(?!IF\s+NOT\s+EXISTS)").unwrap(),
        ),
        (
            "CREATE [UNIQUE] INDEX without IF NOT EXISTS",
            Regex::new(r"(?im)^\s*CREATE\s+(UNIQUE\s+)?INDEX\s+(?!IF\s+NOT\s+EXISTS)").unwrap(),
        ),
        (
            "ADD CONSTRAINT without IF NOT EXISTS",
            Regex::new(
                r"(?im)^\s*ALTER\s+TABLE\s+[^\n]+\s+ADD\s+CONSTRAINT\s+(?!IF\s+NOT\s+EXISTS)",
            )
            .unwrap(),
        ),
        (
            "CREATE TYPE without DO-block guard",
            Regex::new(r"(?im)^\s*CREATE\s+TYPE\s+").unwrap(),
        ),
    ];

    println!("# Migration idempotence audit");
    println!();
    println!("| File | Offending pattern | Count |");
    println!("|---|---|---|");

    let mut total = 0usize;
    let mut files_with_issues = 0usize;

    for entry in WalkDir::new(&dir)
        .into_iter()
        .filter_map(|e| e.ok())
        .filter(|e| e.path().extension().and_then(|s| s.to_str()) == Some("sql"))
    {
        let path: PathBuf = entry.path().into();
        let text = fs::read_to_string(&path).unwrap_or_default();
        let mut file_total = 0usize;
        for (label, re) in &patterns {
            let count = re.find_iter(&text).filter_map(|m| m.ok()).count();
            if count > 0 {
                println!(
                    "| `{}` | {} | {} |",
                    path.display().to_string().replace('\\', "/"),
                    label,
                    count
                );
                file_total += count;
            }
        }
        if file_total > 0 {
            files_with_issues += 1;
        }
        total += file_total;
    }

    println!();
    println!("**Files with issues:** {files_with_issues}");
    println!("**Total offending statements:** {total}");

    if total > 0 {
        std::process::exit(1);
    }
}
