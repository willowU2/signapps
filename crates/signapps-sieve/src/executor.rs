//! Sieve script executor.
//!
//! Evaluates a compiled [`SieveScript`] against a [`SieveContext`] describing
//! an incoming message. Returns a list of [`SieveAction`]s to perform.

use crate::actions::{Comparator, SieveAction, SieveCondition, SieveRule, SieveScript};

/// Message context for Sieve evaluation.
///
/// Contains the metadata needed by Sieve conditions to test against.
///
/// # Examples
///
/// ```
/// use signapps_sieve::SieveContext;
/// let ctx = SieveContext {
///     from: "sender@example.com".to_string(),
///     to: vec!["me@example.com".to_string()],
///     subject: "Hello World".to_string(),
///     headers: vec![
///         ("From".to_string(), "sender@example.com".to_string()),
///         ("Subject".to_string(), "Hello World".to_string()),
///     ],
///     size: 2048,
/// };
/// ```
#[derive(Debug, Clone)]
pub struct SieveContext {
    /// Envelope sender (MAIL FROM).
    pub from: String,
    /// Envelope recipients (RCPT TO).
    pub to: Vec<String>,
    /// Subject header value.
    pub subject: String,
    /// All message headers as (name, value) pairs.
    pub headers: Vec<(String, String)>,
    /// Message size in bytes.
    pub size: usize,
}

/// Execute a compiled Sieve script against a message context.
///
/// Returns the list of actions to perform. If no explicit action is taken
/// (and `stop` is not encountered), an implicit `keep` is appended.
///
/// # Examples
///
/// ```
/// use signapps_sieve::{SieveScript, SieveContext, SieveAction};
/// use signapps_sieve::executor::execute;
///
/// let script = SieveScript::compile(r#"
/// require "fileinto";
/// if header :contains "Subject" "spam" {
///     fileinto "Junk";
///     stop;
/// }
/// "#).unwrap();
///
/// let ctx = SieveContext {
///     from: "spammer@bad.com".to_string(),
///     to: vec!["me@example.com".to_string()],
///     subject: "Buy spam now!".to_string(),
///     headers: vec![("Subject".to_string(), "Buy spam now!".to_string())],
///     size: 512,
/// };
///
/// let actions = execute(&script, &ctx);
/// assert!(actions.iter().any(|a| matches!(a, SieveAction::FileInto(f) if f == "Junk")));
/// ```
///
/// # Panics
///
/// None.
pub fn execute(script: &SieveScript, ctx: &SieveContext) -> Vec<SieveAction> {
    let mut actions = Vec::new();
    let mut stopped = false;
    let mut has_explicit_action = false;

    for rule in &script.rules {
        if stopped {
            break;
        }

        match rule {
            SieveRule::If {
                condition,
                actions: then_actions,
                else_actions,
            } => {
                let matched = evaluate_condition(condition, ctx);
                let chosen_actions = if matched { then_actions } else { else_actions };
                for action in chosen_actions {
                    match action {
                        SieveAction::Stop => {
                            stopped = true;
                            break;
                        }
                        SieveAction::Keep => {
                            has_explicit_action = true;
                            actions.push(SieveAction::Keep);
                        }
                        SieveAction::Discard => {
                            has_explicit_action = true;
                            actions.push(SieveAction::Discard);
                        }
                        _ => {
                            has_explicit_action = true;
                            actions.push(action.clone());
                        }
                    }
                }
            }
            SieveRule::Action(action) => match action {
                SieveAction::Stop => {
                    stopped = true;
                }
                SieveAction::Keep => {
                    has_explicit_action = true;
                    actions.push(SieveAction::Keep);
                }
                SieveAction::Discard => {
                    has_explicit_action = true;
                    actions.push(SieveAction::Discard);
                }
                _ => {
                    has_explicit_action = true;
                    actions.push(action.clone());
                }
            },
        }
    }

    // Implicit keep: if no explicit action was taken and script didn't stop
    if !has_explicit_action && !stopped {
        actions.push(SieveAction::Keep);
    }

    actions
}

/// Evaluate a Sieve condition against a message context.
fn evaluate_condition(condition: &SieveCondition, ctx: &SieveContext) -> bool {
    match condition {
        SieveCondition::Header {
            comparator,
            header,
            value,
        } => {
            let header_lower = header.to_lowercase();
            for (name, val) in &ctx.headers {
                if name.to_lowercase() == header_lower
                    && compare_string(comparator, val, value)
                {
                    return true;
                }
            }
            false
        }
        SieveCondition::Address {
            comparator,
            part,
            value,
        } => {
            let addr = match part.to_lowercase().as_str() {
                "from" => &ctx.from,
                "to" => {
                    return ctx.to.iter().any(|a| compare_string(comparator, a, value));
                }
                _ => {
                    // Check headers for the address part
                    let part_lower = part.to_lowercase();
                    for (name, val) in &ctx.headers {
                        if name.to_lowercase() == part_lower
                            && compare_string(comparator, val, value)
                        {
                            return true;
                        }
                    }
                    return false;
                }
            };
            compare_string(comparator, addr, value)
        }
        SieveCondition::Size { over, size } => {
            if *over {
                ctx.size > *size
            } else {
                ctx.size < *size
            }
        }
        SieveCondition::Exists(header) => {
            let header_lower = header.to_lowercase();
            ctx.headers
                .iter()
                .any(|(name, _)| name.to_lowercase() == header_lower)
        }
        SieveCondition::AllOf(conditions) => {
            conditions.iter().all(|c| evaluate_condition(c, ctx))
        }
        SieveCondition::AnyOf(conditions) => {
            conditions.iter().any(|c| evaluate_condition(c, ctx))
        }
        SieveCondition::Not(inner) => !evaluate_condition(inner, ctx),
        SieveCondition::True => true,
    }
}

/// Compare two strings using the specified comparator.
fn compare_string(comparator: &Comparator, haystack: &str, needle: &str) -> bool {
    match comparator {
        Comparator::Is => haystack.eq_ignore_ascii_case(needle),
        Comparator::Contains => {
            haystack
                .to_lowercase()
                .contains(&needle.to_lowercase())
        }
        Comparator::Matches => glob_match(&haystack.to_lowercase(), &needle.to_lowercase()),
    }
}

/// Simple glob matching (supports `*` and `?` wildcards).
fn glob_match(text: &str, pattern: &str) -> bool {
    let text: Vec<char> = text.chars().collect();
    let pattern: Vec<char> = pattern.chars().collect();
    let (tlen, plen) = (text.len(), pattern.len());
    let mut ti = 0;
    let mut pi = 0;
    let mut star_ti = 0;
    let mut star_pi: Option<usize> = None;

    while ti < tlen {
        if pi < plen && (pattern[pi] == '?' || pattern[pi] == text[ti]) {
            ti += 1;
            pi += 1;
        } else if pi < plen && pattern[pi] == '*' {
            star_pi = Some(pi);
            star_ti = ti;
            pi += 1;
        } else if let Some(sp) = star_pi {
            pi = sp + 1;
            star_ti += 1;
            ti = star_ti;
        } else {
            return false;
        }
    }

    while pi < plen && pattern[pi] == '*' {
        pi += 1;
    }

    pi == plen
}

#[cfg(test)]
mod tests {
    use super::*;

    fn make_ctx(from: &str, subject: &str, size: usize) -> SieveContext {
        SieveContext {
            from: from.to_string(),
            to: vec!["me@example.com".to_string()],
            subject: subject.to_string(),
            headers: vec![
                ("From".to_string(), from.to_string()),
                ("Subject".to_string(), subject.to_string()),
                ("To".to_string(), "me@example.com".to_string()),
            ],
            size,
        }
    }

    #[test]
    fn test_execute_simple_rule() {
        let script = SieveScript::compile(
            r#"
            require "fileinto";
            if header :contains "Subject" "urgent" {
                fileinto "Important";
            }
            "#,
        )
        .unwrap();

        let ctx = make_ctx("boss@example.com", "This is urgent!", 1024);
        let actions = execute(&script, &ctx);
        assert!(actions.iter().any(|a| matches!(a, SieveAction::FileInto(f) if f == "Important")));
    }

    #[test]
    fn test_execute_no_match_implicit_keep() {
        let script = SieveScript::compile(
            r#"
            require "fileinto";
            if header :contains "Subject" "urgent" {
                fileinto "Important";
            }
            "#,
        )
        .unwrap();

        let ctx = make_ctx("friend@example.com", "Hello there", 512);
        let actions = execute(&script, &ctx);
        assert!(actions.contains(&SieveAction::Keep));
    }

    #[test]
    fn test_execute_vacation() {
        let script = SieveScript::compile(
            r#"
            require "vacation";
            vacation :subject "Away" :days 7 "I am on vacation.";
            "#,
        )
        .unwrap();

        let ctx = make_ctx("anyone@example.com", "Hello", 256);
        let actions = execute(&script, &ctx);
        assert!(actions.iter().any(|a| matches!(
            a,
            SieveAction::Vacation { subject, body, days }
            if subject.as_deref() == Some("Away")
                && body == "I am on vacation."
                && *days == 7
        )));
    }

    #[test]
    fn test_execute_discard() {
        let script = SieveScript::compile(
            r#"
            if header :is "From" "spammer@bad.com" {
                discard;
            }
            "#,
        )
        .unwrap();

        let ctx = make_ctx("spammer@bad.com", "Buy now!", 512);
        let actions = execute(&script, &ctx);
        assert!(actions.contains(&SieveAction::Discard));
    }

    #[test]
    fn test_execute_size_over() {
        let script = SieveScript::compile(
            r#"
            if size :over 1M {
                discard;
            }
            "#,
        )
        .unwrap();

        // Under 1M — should keep
        let ctx_small = make_ctx("a@b.com", "Small", 1024);
        let actions = execute(&script, &ctx_small);
        assert!(actions.contains(&SieveAction::Keep));

        // Over 1M — should discard
        let ctx_large = make_ctx("a@b.com", "Large", 2 * 1024 * 1024);
        let actions = execute(&script, &ctx_large);
        assert!(actions.contains(&SieveAction::Discard));
    }

    #[test]
    fn test_execute_allof() {
        let script = SieveScript::compile(
            r#"
            require "fileinto";
            if allof (header :contains "Subject" "report", address :is "from" "bot@example.com") {
                fileinto "Reports";
            }
            "#,
        )
        .unwrap();

        // Both conditions match
        let ctx = make_ctx("bot@example.com", "Weekly report", 1024);
        let actions = execute(&script, &ctx);
        assert!(actions.iter().any(|a| matches!(a, SieveAction::FileInto(f) if f == "Reports")));

        // Only one condition matches
        let ctx2 = make_ctx("human@example.com", "Weekly report", 1024);
        let actions2 = execute(&script, &ctx2);
        assert!(actions2.contains(&SieveAction::Keep));
    }

    #[test]
    fn test_execute_anyof() {
        let script = SieveScript::compile(
            r#"
            require "fileinto";
            if anyof (header :contains "Subject" "alert", header :contains "Subject" "warning") {
                fileinto "Alerts";
            }
            "#,
        )
        .unwrap();

        let ctx = make_ctx("monitor@example.com", "System alert!", 256);
        let actions = execute(&script, &ctx);
        assert!(actions.iter().any(|a| matches!(a, SieveAction::FileInto(f) if f == "Alerts")));
    }

    #[test]
    fn test_execute_not() {
        let script = SieveScript::compile(
            r#"
            require "fileinto";
            if not header :contains "Subject" "important" {
                fileinto "Low Priority";
            }
            "#,
        )
        .unwrap();

        let ctx = make_ctx("a@b.com", "Casual chat", 256);
        let actions = execute(&script, &ctx);
        assert!(
            actions
                .iter()
                .any(|a| matches!(a, SieveAction::FileInto(f) if f == "Low Priority"))
        );
    }

    #[test]
    fn test_execute_stop() {
        let script = SieveScript::compile(
            r#"
            require "fileinto";
            fileinto "First";
            stop;
            fileinto "Second";
            "#,
        )
        .unwrap();

        let ctx = make_ctx("a@b.com", "Test", 256);
        let actions = execute(&script, &ctx);
        assert!(actions.iter().any(|a| matches!(a, SieveAction::FileInto(f) if f == "First")));
        assert!(!actions.iter().any(|a| matches!(a, SieveAction::FileInto(f) if f == "Second")));
    }

    #[test]
    fn test_execute_exists() {
        let script = SieveScript::compile(
            r#"
            require "fileinto";
            if exists "X-Custom-Header" {
                fileinto "Custom";
            }
            "#,
        )
        .unwrap();

        // Without the header — implicit keep
        let ctx1 = make_ctx("a@b.com", "Test", 256);
        let actions1 = execute(&script, &ctx1);
        assert!(actions1.contains(&SieveAction::Keep));

        // With the header
        let mut ctx2 = make_ctx("a@b.com", "Test", 256);
        ctx2.headers
            .push(("X-Custom-Header".to_string(), "value".to_string()));
        let actions2 = execute(&script, &ctx2);
        assert!(actions2.iter().any(|a| matches!(a, SieveAction::FileInto(f) if f == "Custom")));
    }

    #[test]
    fn test_glob_match() {
        assert!(glob_match("hello world", "hello*"));
        assert!(glob_match("hello world", "*world"));
        assert!(glob_match("hello world", "h?llo*"));
        assert!(!glob_match("hello", "world"));
        assert!(glob_match("test", "*"));
        assert!(glob_match("abc", "???"));
        assert!(!glob_match("abcd", "???"));
    }

    #[test]
    fn test_execute_redirect() {
        let script = SieveScript::compile(r#"redirect "admin@example.com";"#).unwrap();
        let ctx = make_ctx("a@b.com", "Forward me", 256);
        let actions = execute(&script, &ctx);
        assert!(actions.iter().any(
            |a| matches!(a, SieveAction::Redirect(addr) if addr == "admin@example.com")
        ));
    }
}
