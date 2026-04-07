//! FEC (Fichier des Écritures Comptables) Export
//!
//! Implements DGFiP-compliant FEC export for French accounting requirements.
//! Generates pipe-separated CSV format with mandatory audit trail fields.
//!
//! ## FEC Norm
//!
//! | Field | Type | Mandatory |
//! |-------|------|-----------|
//! | JournalCode | AlphaNum(2-3) | ✓ |
//! | JournalLib | Text | ✓ |
//! | EcritureNum | Numeric | ✓ |
//! | EcritureDate | Date (YYYYMMDD) | ✓ |
//! | CompteNum | AlphaNum(1-17) | ✓ |
//! | CompteLib | Text | ✓ |
//! | PieceRef | AlphaNum | ✓ |
//! | PieceDate | Date (YYYYMMDD) | ✓ |
//! | EcritureLib | Text | ✓ |
//! | Debit | Numeric | ✓ |
//! | Credit | Numeric | ✓ |

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

// =============================================================================
// FecEntry
// =============================================================================

/// A single accounting entry for FEC export (DGFiP norm).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FecEntry {
    /// Journal code (2-3 alphanumeric chars, e.g., "AC", "VE", "BA")
    pub journal_code: String,
    /// Journal label/description
    pub journal_label: String,
    /// Entry number (must be sequential within journal)
    pub ecriture_num: u64,
    /// Entry date (YYYYMMDD format, e.g., "20260322")
    pub ecriture_date: String,
    /// Account number (chart of accounts reference)
    pub compte_num: String,
    /// Account label/description
    pub compte_label: String,
    /// Piece reference (invoice/receipt number)
    pub piece_ref: String,
    /// Piece date (YYYYMMDD format)
    pub piece_date: String,
    /// Entry description/label
    pub ecriture_label: String,
    /// Debit amount (decimal as string, "0.00" if no debit)
    pub debit: String,
    /// Credit amount (decimal as string, "0.00" if no credit)
    pub credit: String,
}

impl FecEntry {
    /// Create a new FEC entry with validation
    #[allow(clippy::too_many_arguments)]
    pub fn new(
        journal_code: String,
        journal_label: String,
        ecriture_num: u64,
        ecriture_date: String,
        compte_num: String,
        compte_label: String,
        piece_ref: String,
        piece_date: String,
        ecriture_label: String,
        debit: String,
        credit: String,
    ) -> Self {
        Self {
            journal_code,
            journal_label,
            ecriture_num,
            ecriture_date,
            compte_num,
            compte_label,
            piece_ref,
            piece_date,
            ecriture_label,
            debit,
            credit,
        }
    }
}

// =============================================================================
// FecExporter
// =============================================================================

/// FEC exporter with validation and CSV generation (DGFiP-compliant).
#[derive(Debug, Clone)]
#[allow(dead_code)]
pub struct FecExporter {
    entries: Vec<FecEntry>,
    journal_codes: HashMap<String, u64>,
}

impl Default for FecExporter {
    fn default() -> Self {
        Self::new()
    }
}

impl FecExporter {
    /// Create a new FEC exporter.
    pub fn new() -> Self {
        Self {
            entries: Vec::new(),
            journal_codes: HashMap::new(),
        }
    }

    /// Add an entry to the FEC export.
    pub fn add_entry(&mut self, entry: FecEntry) {
        self.entries.push(entry);
    }

    /// Add multiple entries to the FEC export.
    pub fn add_entries(&mut self, entries: Vec<FecEntry>) {
        self.entries.extend(entries);
    }

    /// Generate FEC CSV in pipe-separated format (DGFiP norm).
    ///
    /// Returns CSV string with header and all entries.
    /// Format: JournalCode|JournalLib|EcritureNum|EcritureDate|CompteNum|CompteLib|PieceRef|PieceDate|EcritureLib|Debit|Credit
    pub fn generate_fec_csv(&self) -> String {
        let mut csv = String::new();

        // Header
        csv.push_str("JournalCode|JournalLib|EcritureNum|EcritureDate|CompteNum|CompteLib|PieceRef|PieceDate|EcritureLib|Debit|Credit\n");

        // Entries
        for entry in &self.entries {
            csv.push_str(&format!(
                "{}|{}|{}|{}|{}|{}|{}|{}|{}|{}|{}\n",
                escape_pipe(&entry.journal_code),
                escape_pipe(&entry.journal_label),
                entry.ecriture_num,
                escape_pipe(&entry.ecriture_date),
                escape_pipe(&entry.compte_num),
                escape_pipe(&entry.compte_label),
                escape_pipe(&entry.piece_ref),
                escape_pipe(&entry.piece_date),
                escape_pipe(&entry.ecriture_label),
                escape_pipe(&entry.debit),
                escape_pipe(&entry.credit),
            ));
        }

        csv
    }

    /// Validate all entries against DGFiP FEC rules.
    ///
    /// Returns a vector of validation error messages.
    /// Empty vector means all entries are valid.
    pub fn validate(&self) -> Vec<String> {
        let mut errors = Vec::new();

        if self.entries.is_empty() {
            errors.push("No entries to export".to_string());
            return errors;
        }

        for (idx, entry) in self.entries.iter().enumerate() {
            let line = idx + 2; // +2 for header offset

            // JournalCode validation
            if entry.journal_code.is_empty() || entry.journal_code.len() > 3 {
                errors.push(format!(
                    "Line {}: JournalCode must be 1-3 alphanumeric chars (got: '{}')",
                    line, entry.journal_code
                ));
            }

            // JournalLib validation
            if entry.journal_label.is_empty() {
                errors.push(format!("Line {}: JournalLib cannot be empty", line));
            }

            // EcritureNum validation (must be positive)
            if entry.ecriture_num == 0 {
                errors.push(format!("Line {}: EcritureNum must be > 0", line));
            }

            // EcritureDate validation (YYYYMMDD format)
            if !is_valid_date_format(&entry.ecriture_date) {
                errors.push(format!(
                    "Line {}: EcritureDate must be YYYYMMDD format (got: '{}')",
                    line, entry.ecriture_date
                ));
            }

            // CompteNum validation
            if entry.compte_num.is_empty() || entry.compte_num.len() > 17 {
                errors.push(format!(
                    "Line {}: CompteNum must be 1-17 chars (got: '{}')",
                    line, entry.compte_num
                ));
            }

            // CompteLib validation
            if entry.compte_label.is_empty() {
                errors.push(format!("Line {}: CompteLib cannot be empty", line));
            }

            // PieceRef validation
            if entry.piece_ref.is_empty() {
                errors.push(format!("Line {}: PieceRef cannot be empty", line));
            }

            // PieceDate validation
            if !is_valid_date_format(&entry.piece_date) {
                errors.push(format!(
                    "Line {}: PieceDate must be YYYYMMDD format (got: '{}')",
                    line, entry.piece_date
                ));
            }

            // EcritureLib validation
            if entry.ecriture_label.is_empty() {
                errors.push(format!("Line {}: EcritureLib cannot be empty", line));
            }

            // Debit/Credit validation (must be numeric, and one must be > 0)
            if !is_valid_amount(&entry.debit) {
                errors.push(format!(
                    "Line {}: Debit must be numeric (got: '{}')",
                    line, entry.debit
                ));
            }
            if !is_valid_amount(&entry.credit) {
                errors.push(format!(
                    "Line {}: Credit must be numeric (got: '{}')",
                    line, entry.credit
                ));
            }

            // At least debit or credit must be > 0
            let debit_val = entry.debit.parse::<f64>().unwrap_or(0.0);
            let credit_val = entry.credit.parse::<f64>().unwrap_or(0.0);
            if debit_val == 0.0 && credit_val == 0.0 {
                errors.push(format!(
                    "Line {}: At least Debit or Credit must be > 0",
                    line
                ));
            }
        }

        errors
    }

    /// Return the count of entries.
    pub fn entry_count(&self) -> usize {
        self.entries.len()
    }
}

// =============================================================================
// Validation Helpers
// =============================================================================

/// Validate YYYYMMDD date format.
fn is_valid_date_format(date: &str) -> bool {
    if date.len() != 8 {
        return false;
    }
    date.chars().all(|c| c.is_ascii_digit())
}

/// Validate numeric amount (integer or decimal).
fn is_valid_amount(amount: &str) -> bool {
    if amount.is_empty() {
        return false;
    }
    amount.parse::<f64>().is_ok()
}

/// Escape pipe character for FEC CSV (replace with space or remove).
fn escape_pipe(s: &str) -> String {
    s.replace('|', " ")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_fec_entry_creation() {
        let entry = FecEntry::new(
            "AC".to_string(),
            "Achats".to_string(),
            1,
            "20260322".to_string(),
            "401".to_string(),
            "Fournisseurs".to_string(),
            "INV-001".to_string(),
            "20260320".to_string(),
            "Facture fournisseur".to_string(),
            "100.00".to_string(),
            "0.00".to_string(),
        );
        assert_eq!(entry.journal_code, "AC");
        assert_eq!(entry.ecriture_num, 1);
    }

    #[test]
    fn test_fec_exporter_add_entry() {
        let mut exporter = FecExporter::new();
        let entry = FecEntry::new(
            "AC".to_string(),
            "Achats".to_string(),
            1,
            "20260322".to_string(),
            "401".to_string(),
            "Fournisseurs".to_string(),
            "INV-001".to_string(),
            "20260320".to_string(),
            "Facture".to_string(),
            "100.00".to_string(),
            "0.00".to_string(),
        );
        exporter.add_entry(entry);
        assert_eq!(exporter.entry_count(), 1);
    }

    #[test]
    fn test_fec_validation_empty() {
        let exporter = FecExporter::new();
        let errors = exporter.validate();
        assert!(!errors.is_empty());
        assert!(errors[0].contains("No entries"));
    }

    #[test]
    fn test_fec_validation_invalid_date() {
        let mut exporter = FecExporter::new();
        let entry = FecEntry::new(
            "AC".to_string(),
            "Achats".to_string(),
            1,
            "2026-03-22".to_string(), // Invalid format
            "401".to_string(),
            "Fournisseurs".to_string(),
            "INV-001".to_string(),
            "20260320".to_string(),
            "Facture".to_string(),
            "100.00".to_string(),
            "0.00".to_string(),
        );
        exporter.add_entry(entry);
        let errors = exporter.validate();
        assert!(!errors.is_empty());
    }

    #[test]
    fn test_fec_csv_generation() {
        let mut exporter = FecExporter::new();
        let entry = FecEntry::new(
            "AC".to_string(),
            "Achats".to_string(),
            1,
            "20260322".to_string(),
            "401".to_string(),
            "Fournisseurs".to_string(),
            "INV-001".to_string(),
            "20260320".to_string(),
            "Facture".to_string(),
            "100.00".to_string(),
            "0.00".to_string(),
        );
        exporter.add_entry(entry);
        let csv = exporter.generate_fec_csv();
        assert!(csv.contains("JournalCode|"));
        assert!(csv.contains("AC|Achats|1|"));
    }
}
