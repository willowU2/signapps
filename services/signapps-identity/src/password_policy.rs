//! Password Policy Enforcement.
//!
//! Validates passwords against configurable rules.

#[derive(Debug, Clone)]
/// Represents a password policy.
pub struct PasswordPolicy {
    pub min_length: usize,
    pub require_uppercase: bool,
    pub require_lowercase: bool,
    pub require_digit: bool,
    pub require_special: bool,
    pub max_length: usize,
}

impl Default for PasswordPolicy {
    fn default() -> Self {
        Self {
            min_length: 8,
            require_uppercase: true,
            require_lowercase: true,
            require_digit: true,
            require_special: false,
            max_length: 128,
        }
    }
}

#[derive(Debug)]
/// Represents a policy violation.
pub struct PolicyViolation {
    pub code: &'static str,
    pub message: String,
}

impl PasswordPolicy {
    pub fn validate(&self, password: &str) -> Result<(), Vec<PolicyViolation>> {
        let mut violations = Vec::new();

        if password.len() < self.min_length {
            violations.push(PolicyViolation {
                code: "too_short",
                message: format!("Le mot de passe doit contenir au moins {} caractères", self.min_length),
            });
        }

        if password.len() > self.max_length {
            violations.push(PolicyViolation {
                code: "too_long",
                message: format!("Le mot de passe ne doit pas dépasser {} caractères", self.max_length),
            });
        }

        if self.require_uppercase && !password.chars().any(|c| c.is_uppercase()) {
            violations.push(PolicyViolation {
                code: "no_uppercase",
                message: "Le mot de passe doit contenir au moins une majuscule".into(),
            });
        }

        if self.require_lowercase && !password.chars().any(|c| c.is_lowercase()) {
            violations.push(PolicyViolation {
                code: "no_lowercase",
                message: "Le mot de passe doit contenir au moins une minuscule".into(),
            });
        }

        if self.require_digit && !password.chars().any(|c| c.is_ascii_digit()) {
            violations.push(PolicyViolation {
                code: "no_digit",
                message: "Le mot de passe doit contenir au moins un chiffre".into(),
            });
        }

        if self.require_special && !password.chars().any(|c| !c.is_alphanumeric()) {
            violations.push(PolicyViolation {
                code: "no_special",
                message: "Le mot de passe doit contenir au moins un caractère spécial".into(),
            });
        }

        if violations.is_empty() {
            Ok(())
        } else {
            Err(violations)
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_valid_password() {
        let policy = PasswordPolicy::default();
        assert!(policy.validate("SecureP4ss").is_ok());
    }

    #[test]
    fn test_strong_password_passes() {
        let policy = PasswordPolicy {
            min_length: 8,
            require_uppercase: true,
            require_lowercase: true,
            require_digit: true,
            require_special: true,
            max_length: 128,
        };
        assert!(policy.validate("Str0ng!Pass").is_ok());
    }

    #[test]
    fn test_too_short() {
        let policy = PasswordPolicy::default();
        let result = policy.validate("Ab1");
        assert!(result.is_err());
        assert!(result.unwrap_err().iter().any(|v| v.code == "too_short"));
    }

    #[test]
    fn test_short_password_fails() {
        let policy = PasswordPolicy::default();
        // 7 chars — below min_length of 8
        let result = policy.validate("Short1A");
        assert!(result.is_err());
        let violations = result.unwrap_err();
        assert!(violations.iter().any(|v| v.code == "too_short"));
    }

    #[test]
    fn test_no_uppercase() {
        let policy = PasswordPolicy::default();
        let result = policy.validate("lowercase1only");
        assert!(result.is_err());
    }

    #[test]
    fn test_password_without_uppercase_fails() {
        let policy = PasswordPolicy {
            require_uppercase: true,
            ..Default::default()
        };
        let result = policy.validate("nouppercase1");
        assert!(result.is_err());
        let violations = result.unwrap_err();
        assert!(violations.iter().any(|v| v.code == "no_uppercase"));
    }

    #[test]
    fn test_password_without_digit_fails() {
        let policy = PasswordPolicy {
            require_digit: true,
            ..Default::default()
        };
        let result = policy.validate("NoDigitPass");
        assert!(result.is_err());
        let violations = result.unwrap_err();
        assert!(violations.iter().any(|v| v.code == "no_digit"));
    }

    #[test]
    fn test_password_without_special_char_fails() {
        let policy = PasswordPolicy {
            require_special: true,
            ..Default::default()
        };
        let result = policy.validate("NoSpecial1A");
        assert!(result.is_err());
        let violations = result.unwrap_err();
        assert!(violations.iter().any(|v| v.code == "no_special"));
    }

    #[test]
    fn test_password_without_special_char_passes_when_not_required() {
        let policy = PasswordPolicy {
            require_special: false,
            ..Default::default()
        };
        // No special char but not required
        assert!(policy.validate("NoSpecial1A").is_ok());
    }

    #[test]
    fn test_too_long_password_fails() {
        let policy = PasswordPolicy::default();
        let long_pass = "A1a".repeat(50); // 150 chars > max_length 128
        let result = policy.validate(&long_pass);
        assert!(result.is_err());
        let violations = result.unwrap_err();
        assert!(violations.iter().any(|v| v.code == "too_long"));
    }

    #[test]
    fn test_multiple_violations_reported() {
        let policy = PasswordPolicy::default();
        // Too short AND missing digit
        let result = policy.validate("ab");
        assert!(result.is_err());
        let violations = result.unwrap_err();
        assert!(violations.len() >= 2, "Should report multiple violations");
    }
}
