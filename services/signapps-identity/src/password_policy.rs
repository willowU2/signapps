//! Password Policy Enforcement.
//!
//! Validates passwords against configurable rules.

#[derive(Debug, Clone)]
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
    fn test_too_short() {
        let policy = PasswordPolicy::default();
        let result = policy.validate("Ab1");
        assert!(result.is_err());
        assert!(result.unwrap_err().iter().any(|v| v.code == "too_short"));
    }

    #[test]
    fn test_no_uppercase() {
        let policy = PasswordPolicy::default();
        let result = policy.validate("lowercase1only");
        assert!(result.is_err());
    }
}
