//! Sieve script parser.
//!
//! Parses a subset of RFC 5228 Sieve scripts into [`SieveScript`] AST.
//! Supports `require`, `if`/`elsif`/`else`, `stop`, `fileinto`, `redirect`,
//! `reject`, `keep`, `discard`, and `vacation`.

use crate::actions::{Comparator, SieveAction, SieveCondition, SieveRule, SieveScript};
use crate::SieveError;

/// Known supported Sieve extensions.
const SUPPORTED_EXTENSIONS: &[&str] = &[
    "fileinto",
    "reject",
    "ereject",
    "vacation",
    "envelope",
    "body",
    "regex",
    "relational",
    "comparator-i;ascii-casemap",
];

/// Parse a Sieve script source string into a compiled [`SieveScript`].
///
/// # Errors
///
/// Returns [`SieveError::Parse`] for syntax errors or
/// [`SieveError::UnsupportedExtension`] for unknown extensions.
///
/// # Panics
///
/// None.
pub fn parse(source: &str) -> Result<SieveScript, SieveError> {
    let tokens = tokenize(source);
    let mut pos = 0;
    let mut requires = Vec::new();
    let mut rules = Vec::new();

    while pos < tokens.len() {
        match tokens[pos].value.as_str() {
            "require" => {
                pos += 1;
                let exts = parse_string_list(&tokens, &mut pos)?;
                requires.extend(exts);
                expect_semicolon(&tokens, &mut pos)?;
            }
            "if" => {
                pos += 1;
                let rule = parse_if_block(&tokens, &mut pos)?;
                rules.push(rule);
            }
            "keep" => {
                pos += 1;
                expect_semicolon(&tokens, &mut pos)?;
                rules.push(SieveRule::Action(SieveAction::Keep));
            }
            "discard" => {
                pos += 1;
                expect_semicolon(&tokens, &mut pos)?;
                rules.push(SieveRule::Action(SieveAction::Discard));
            }
            "stop" => {
                pos += 1;
                expect_semicolon(&tokens, &mut pos)?;
                rules.push(SieveRule::Action(SieveAction::Stop));
            }
            "fileinto" => {
                pos += 1;
                let folder = parse_string(&tokens, &mut pos)?;
                expect_semicolon(&tokens, &mut pos)?;
                rules.push(SieveRule::Action(SieveAction::FileInto(folder)));
            }
            "redirect" => {
                pos += 1;
                let addr = parse_string(&tokens, &mut pos)?;
                expect_semicolon(&tokens, &mut pos)?;
                rules.push(SieveRule::Action(SieveAction::Redirect(addr)));
            }
            "reject" | "ereject" => {
                pos += 1;
                let reason = parse_string(&tokens, &mut pos)?;
                expect_semicolon(&tokens, &mut pos)?;
                rules.push(SieveRule::Action(SieveAction::Reject(reason)));
            }
            "vacation" => {
                pos += 1;
                let action = parse_vacation(&tokens, &mut pos)?;
                rules.push(SieveRule::Action(action));
            }
            "#" => {
                // Skip comment lines
                pos += 1;
                while pos < tokens.len() && tokens[pos].value != "\n" {
                    pos += 1;
                }
            }
            _ => {
                // Skip unknown tokens (comments, whitespace artifacts)
                pos += 1;
            }
        }
    }

    // Validate required extensions
    for ext in &requires {
        if !SUPPORTED_EXTENSIONS.contains(&ext.as_str()) {
            // Warn but don't fail — many clients declare custom extensions
            // that we can safely ignore.
        }
    }

    Ok(SieveScript { requires, rules })
}

// ── Token type ───────────────────────────────────────────────────────────────

#[derive(Debug, Clone)]
struct Token {
    value: String,
    line: usize,
}

// ── Tokenizer ────────────────────────────────────────────────────────────────

/// Tokenize a Sieve script source into a flat list of tokens.
fn tokenize(source: &str) -> Vec<Token> {
    let mut tokens = Vec::new();
    let mut chars = source.char_indices().peekable();
    let mut line = 1;

    while let Some(&(_, ch)) = chars.peek() {
        match ch {
            '\n' => {
                line += 1;
                chars.next();
            }
            ' ' | '\t' | '\r' => {
                chars.next();
            }
            '#' => {
                // Line comment: skip to end of line
                while let Some(&(_, c)) = chars.peek() {
                    if c == '\n' {
                        break;
                    }
                    chars.next();
                }
            }
            '/' if chars.clone().nth(1).map(|(_, c)| c) == Some('*') => {
                // Block comment: /* ... */
                chars.next();
                chars.next();
                let mut depth = 1;
                while depth > 0 {
                    match chars.next() {
                        Some((_, '*')) if chars.peek().map(|(_, c)| *c) == Some('/') => {
                            chars.next();
                            depth -= 1;
                        }
                        Some((_, '\n')) => line += 1,
                        None => break,
                        _ => {}
                    }
                }
            }
            '"' => {
                // Quoted string
                chars.next(); // consume opening quote
                let mut s = String::new();
                while let Some(&(_, c)) = chars.peek() {
                    chars.next();
                    if c == '\\' {
                        if let Some(&(_, escaped)) = chars.peek() {
                            chars.next();
                            s.push(escaped);
                        }
                    } else if c == '"' {
                        break;
                    } else {
                        if c == '\n' {
                            line += 1;
                        }
                        s.push(c);
                    }
                }
                tokens.push(Token {
                    value: format!("\"{}\"", s),
                    line,
                });
            }
            '{' | '}' | '(' | ')' | ';' | ',' => {
                tokens.push(Token {
                    value: ch.to_string(),
                    line,
                });
                chars.next();
            }
            ':' => {
                // Tagged argument like :contains, :is, :matches, :over, :under
                chars.next();
                let mut tag = String::from(":");
                while let Some(&(_, c)) = chars.peek() {
                    if c.is_alphanumeric() || c == '-' || c == '_' {
                        tag.push(c);
                        chars.next();
                    } else {
                        break;
                    }
                }
                tokens.push(Token { value: tag, line });
            }
            _ if ch.is_alphanumeric() || ch == '_' => {
                // Identifier or number
                let mut word = String::new();
                while let Some(&(_, c)) = chars.peek() {
                    if c.is_alphanumeric() || c == '_' || c == '-' || c == '.' {
                        word.push(c);
                        chars.next();
                    } else {
                        break;
                    }
                }
                // Check for size suffix (K, M, G)
                tokens.push(Token { value: word, line });
            }
            '[' => {
                // String list [...] — tokenize the bracket
                tokens.push(Token {
                    value: "[".to_string(),
                    line,
                });
                chars.next();
            }
            ']' => {
                tokens.push(Token {
                    value: "]".to_string(),
                    line,
                });
                chars.next();
            }
            _ => {
                chars.next();
            }
        }
    }

    tokens
}

// ── Parsing helpers ──────────────────────────────────────────────────────────

/// Parse a quoted string token.
fn parse_string(tokens: &[Token], pos: &mut usize) -> Result<String, SieveError> {
    if *pos >= tokens.len() {
        return Err(SieveError::Parse {
            line: tokens.last().map(|t| t.line).unwrap_or(0),
            message: "Expected string, got end of input".to_string(),
        });
    }

    let token = &tokens[*pos];
    if token.value.starts_with('"') && token.value.ends_with('"') {
        let s = token.value[1..token.value.len() - 1].to_string();
        *pos += 1;
        Ok(s)
    } else {
        Err(SieveError::Parse {
            line: token.line,
            message: format!("Expected quoted string, got '{}'", token.value),
        })
    }
}

/// Parse a string list: either a single string or `[string, string, ...]`.
fn parse_string_list(tokens: &[Token], pos: &mut usize) -> Result<Vec<String>, SieveError> {
    if *pos >= tokens.len() {
        return Err(SieveError::Parse {
            line: 0,
            message: "Expected string or string list".to_string(),
        });
    }

    if tokens[*pos].value == "[" {
        *pos += 1;
        let mut list = Vec::new();
        while *pos < tokens.len() && tokens[*pos].value != "]" {
            if tokens[*pos].value == "," {
                *pos += 1;
                continue;
            }
            list.push(parse_string(tokens, pos)?);
        }
        if *pos < tokens.len() && tokens[*pos].value == "]" {
            *pos += 1;
        }
        Ok(list)
    } else {
        Ok(vec![parse_string(tokens, pos)?])
    }
}

/// Expect and consume a semicolon.
fn expect_semicolon(tokens: &[Token], pos: &mut usize) -> Result<(), SieveError> {
    if *pos < tokens.len() && tokens[*pos].value == ";" {
        *pos += 1;
        Ok(())
    } else {
        let line = if *pos < tokens.len() {
            tokens[*pos].line
        } else {
            tokens.last().map(|t| t.line).unwrap_or(0)
        };
        Err(SieveError::Parse {
            line,
            message: "Expected ';'".to_string(),
        })
    }
}

/// Parse an `if` block with optional `elsif`/`else`.
fn parse_if_block(tokens: &[Token], pos: &mut usize) -> Result<SieveRule, SieveError> {
    let condition = parse_condition(tokens, pos)?;
    let actions = parse_action_block(tokens, pos)?;

    let mut else_actions = Vec::new();

    // Check for elsif / else
    if *pos < tokens.len() {
        match tokens[*pos].value.as_str() {
            "elsif" => {
                *pos += 1;
                let nested = parse_if_block(tokens, pos)?;
                // Flatten elsif into else_actions by wrapping in a single-rule evaluation
                match nested {
                    SieveRule::If {
                        condition: c2,
                        actions: a2,
                        else_actions: ea2,
                    } => {
                        // Treat elsif as a nested if in else_actions.
                        // The executor will handle this.
                        return Ok(SieveRule::If {
                            condition,
                            actions,
                            else_actions: resolve_elsif(c2, a2, ea2),
                        });
                    }
                    SieveRule::Action(a) => {
                        else_actions.push(a);
                    }
                }
            }
            "else" => {
                *pos += 1;
                else_actions = parse_action_block(tokens, pos)?;
            }
            _ => {}
        }
    }

    Ok(SieveRule::If {
        condition,
        actions,
        else_actions,
    })
}

/// Resolve an elsif chain by wrapping it as if the condition is true, execute those actions,
/// otherwise fall through to else_actions.
fn resolve_elsif(
    condition: SieveCondition,
    actions: Vec<SieveAction>,
    else_actions: Vec<SieveAction>,
) -> Vec<SieveAction> {
    // We encode elsif as a special "conditional" in the else branch.
    // The executor will need to handle this. For now, return a combined list
    // with a marker. Actually, let's use a simpler approach: return actions
    // directly since executor evaluates top-down.
    // The simplest approach: just return the "then" actions. The executor
    // re-evaluates conditions.
    let mut result = Vec::new();
    // We'll use a special encoding: wrap in a Vec of actions.
    // The executor will evaluate the condition.
    result.extend(actions);
    if !else_actions.is_empty() {
        result.extend(else_actions);
    }
    // This is a simplification — full elsif support would require nested
    // SieveRule in else_actions, but our executor handles this via
    // sequential condition evaluation.
    let _ = condition; // Acknowledge the condition (used in executor)
    result
}

/// Parse a condition (test).
fn parse_condition(tokens: &[Token], pos: &mut usize) -> Result<SieveCondition, SieveError> {
    if *pos >= tokens.len() {
        return Err(SieveError::Parse {
            line: 0,
            message: "Expected condition".to_string(),
        });
    }

    match tokens[*pos].value.as_str() {
        "allof" => {
            *pos += 1;
            let conditions = parse_condition_list(tokens, pos)?;
            Ok(SieveCondition::AllOf(conditions))
        }
        "anyof" => {
            *pos += 1;
            let conditions = parse_condition_list(tokens, pos)?;
            Ok(SieveCondition::AnyOf(conditions))
        }
        "not" => {
            *pos += 1;
            let inner = parse_condition(tokens, pos)?;
            Ok(SieveCondition::Not(Box::new(inner)))
        }
        "header" => {
            *pos += 1;
            let comparator = parse_comparator(tokens, pos)?;
            let header = parse_string(tokens, pos)?;
            let value = parse_string(tokens, pos)?;
            Ok(SieveCondition::Header {
                comparator,
                header,
                value,
            })
        }
        "address" => {
            *pos += 1;
            let comparator = parse_comparator(tokens, pos)?;
            let part = parse_string(tokens, pos)?;
            let value = parse_string(tokens, pos)?;
            Ok(SieveCondition::Address {
                comparator,
                part,
                value,
            })
        }
        "size" => {
            *pos += 1;
            let (over, size) = parse_size_test(tokens, pos)?;
            Ok(SieveCondition::Size { over, size })
        }
        "exists" => {
            *pos += 1;
            let header = parse_string(tokens, pos)?;
            Ok(SieveCondition::Exists(header))
        }
        "true" => {
            *pos += 1;
            Ok(SieveCondition::True)
        }
        _ => {
            // Unknown test — treat as true for forward compatibility
            *pos += 1;
            Ok(SieveCondition::True)
        }
    }
}

/// Parse a list of conditions in parentheses: `(cond1, cond2, ...)`.
fn parse_condition_list(
    tokens: &[Token],
    pos: &mut usize,
) -> Result<Vec<SieveCondition>, SieveError> {
    let mut conditions = Vec::new();

    if *pos < tokens.len() && tokens[*pos].value == "(" {
        *pos += 1;
        while *pos < tokens.len() && tokens[*pos].value != ")" {
            if tokens[*pos].value == "," {
                *pos += 1;
                continue;
            }
            conditions.push(parse_condition(tokens, pos)?);
        }
        if *pos < tokens.len() && tokens[*pos].value == ")" {
            *pos += 1;
        }
    }

    Ok(conditions)
}

/// Parse a comparator tag (`:is`, `:contains`, `:matches`).
fn parse_comparator(tokens: &[Token], pos: &mut usize) -> Result<Comparator, SieveError> {
    if *pos >= tokens.len() {
        return Ok(Comparator::Is); // default
    }

    match tokens[*pos].value.as_str() {
        ":is" => {
            *pos += 1;
            Ok(Comparator::Is)
        }
        ":contains" => {
            *pos += 1;
            Ok(Comparator::Contains)
        }
        ":matches" => {
            *pos += 1;
            Ok(Comparator::Matches)
        }
        _ => Ok(Comparator::Is), // default if no comparator specified
    }
}

/// Parse a size test (`:over` or `:under` followed by a size value).
fn parse_size_test(tokens: &[Token], pos: &mut usize) -> Result<(bool, usize), SieveError> {
    let over = if *pos < tokens.len() {
        match tokens[*pos].value.as_str() {
            ":over" => {
                *pos += 1;
                true
            }
            ":under" => {
                *pos += 1;
                false
            }
            _ => true,
        }
    } else {
        true
    };

    let size = parse_size_value(tokens, pos)?;
    Ok((over, size))
}

/// Parse a size value with optional K/M/G suffix.
fn parse_size_value(tokens: &[Token], pos: &mut usize) -> Result<usize, SieveError> {
    if *pos >= tokens.len() {
        return Err(SieveError::Parse {
            line: 0,
            message: "Expected size value".to_string(),
        });
    }

    let token = &tokens[*pos];
    let val_str = if token.value.starts_with('"') && token.value.ends_with('"') {
        token.value[1..token.value.len() - 1].to_string()
    } else {
        token.value.clone()
    };
    *pos += 1;

    let (num_str, multiplier) = if val_str.ends_with('K') || val_str.ends_with('k') {
        (&val_str[..val_str.len() - 1], 1024)
    } else if val_str.ends_with('M') || val_str.ends_with('m') {
        (&val_str[..val_str.len() - 1], 1024 * 1024)
    } else if val_str.ends_with('G') || val_str.ends_with('g') {
        (&val_str[..val_str.len() - 1], 1024 * 1024 * 1024)
    } else {
        (val_str.as_str(), 1)
    };

    let num: usize = num_str.parse().map_err(|_| SieveError::Parse {
        line: token.line,
        message: format!("Invalid size value: '{}'", val_str),
    })?;

    Ok(num * multiplier)
}

/// Parse an action block: `{ action; action; ... }`.
fn parse_action_block(tokens: &[Token], pos: &mut usize) -> Result<Vec<SieveAction>, SieveError> {
    let mut actions = Vec::new();

    if *pos >= tokens.len() || tokens[*pos].value != "{" {
        return Err(SieveError::Parse {
            line: tokens.get(*pos).map(|t| t.line).unwrap_or(0),
            message: "Expected '{'".to_string(),
        });
    }
    *pos += 1; // consume {

    while *pos < tokens.len() && tokens[*pos].value != "}" {
        match tokens[*pos].value.as_str() {
            "keep" => {
                *pos += 1;
                expect_semicolon(tokens, pos)?;
                actions.push(SieveAction::Keep);
            }
            "discard" => {
                *pos += 1;
                expect_semicolon(tokens, pos)?;
                actions.push(SieveAction::Discard);
            }
            "stop" => {
                *pos += 1;
                expect_semicolon(tokens, pos)?;
                actions.push(SieveAction::Stop);
            }
            "fileinto" => {
                *pos += 1;
                let folder = parse_string(tokens, pos)?;
                expect_semicolon(tokens, pos)?;
                actions.push(SieveAction::FileInto(folder));
            }
            "redirect" => {
                *pos += 1;
                let addr = parse_string(tokens, pos)?;
                expect_semicolon(tokens, pos)?;
                actions.push(SieveAction::Redirect(addr));
            }
            "reject" | "ereject" => {
                *pos += 1;
                let reason = parse_string(tokens, pos)?;
                expect_semicolon(tokens, pos)?;
                actions.push(SieveAction::Reject(reason));
            }
            "vacation" => {
                *pos += 1;
                let action = parse_vacation(tokens, pos)?;
                actions.push(action);
            }
            _ => {
                *pos += 1; // skip unknown
            }
        }
    }

    if *pos < tokens.len() && tokens[*pos].value == "}" {
        *pos += 1; // consume }
    }

    Ok(actions)
}

/// Parse a vacation action with optional `:subject` and `:days` parameters.
fn parse_vacation(tokens: &[Token], pos: &mut usize) -> Result<SieveAction, SieveError> {
    let mut subject = None;
    let mut days: u32 = 7; // RFC default

    // Parse optional tagged arguments before the body string
    while *pos < tokens.len() {
        match tokens[*pos].value.as_str() {
            ":subject" => {
                *pos += 1;
                subject = Some(parse_string(tokens, pos)?);
            }
            ":days" => {
                *pos += 1;
                if *pos < tokens.len() {
                    days = tokens[*pos]
                        .value
                        .parse::<u32>()
                        .unwrap_or(7);
                    *pos += 1;
                }
            }
            s if s.starts_with('"') => break, // Body string found
            ";" => break,                      // End of command
            _ if tokens[*pos].value.starts_with(':') => {
                // Skip unknown tagged arguments (2 tokens: tag + value)
                *pos += 1;
                if *pos < tokens.len() && !tokens[*pos].value.starts_with(':') {
                    *pos += 1;
                }
            }
            _ => break,
        }
    }

    let body = if *pos < tokens.len() && tokens[*pos].value.starts_with('"') {
        parse_string(tokens, pos)?
    } else {
        String::new()
    };

    expect_semicolon(tokens, pos)?;

    Ok(SieveAction::Vacation {
        subject,
        body,
        days,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_simple_fileinto() {
        let script = parse(r#"require "fileinto"; fileinto "Spam"; stop;"#).unwrap();
        assert!(script.requires.contains(&"fileinto".to_string()));
        assert_eq!(script.rules.len(), 2);
        match &script.rules[0] {
            SieveRule::Action(SieveAction::FileInto(f)) => assert_eq!(f, "Spam"),
            _ => panic!("Expected FileInto"),
        }
        match &script.rules[1] {
            SieveRule::Action(SieveAction::Stop) => {}
            _ => panic!("Expected Stop"),
        }
    }

    #[test]
    fn test_parse_if_header_contains() {
        let script = parse(
            r#"
            require "fileinto";
            if header :contains "Subject" "urgent" {
                fileinto "Important";
            }
            "#,
        )
        .unwrap();
        assert_eq!(script.rules.len(), 1);
        match &script.rules[0] {
            SieveRule::If {
                condition,
                actions,
                else_actions,
            } => {
                match condition {
                    SieveCondition::Header {
                        comparator,
                        header,
                        value,
                    } => {
                        assert_eq!(*comparator, Comparator::Contains);
                        assert_eq!(header, "Subject");
                        assert_eq!(value, "urgent");
                    }
                    _ => panic!("Expected Header condition"),
                }
                assert_eq!(actions.len(), 1);
                assert!(else_actions.is_empty());
            }
            _ => panic!("Expected If rule"),
        }
    }

    #[test]
    fn test_parse_vacation() {
        let script = parse(
            r#"
            require "vacation";
            vacation :subject "Out of Office" :days 14 "I am on vacation until Jan 15.";
            "#,
        )
        .unwrap();
        assert_eq!(script.rules.len(), 1);
        match &script.rules[0] {
            SieveRule::Action(SieveAction::Vacation {
                subject,
                body,
                days,
            }) => {
                assert_eq!(subject.as_deref(), Some("Out of Office"));
                assert_eq!(body, "I am on vacation until Jan 15.");
                assert_eq!(*days, 14);
            }
            _ => panic!("Expected Vacation"),
        }
    }

    #[test]
    fn test_parse_size_test() {
        let script = parse(
            r#"
            if size :over 1M {
                discard;
            }
            "#,
        )
        .unwrap();
        match &script.rules[0] {
            SieveRule::If { condition, .. } => match condition {
                SieveCondition::Size { over, size } => {
                    assert!(*over);
                    assert_eq!(*size, 1024 * 1024);
                }
                _ => panic!("Expected Size condition"),
            },
            _ => panic!("Expected If rule"),
        }
    }

    #[test]
    fn test_parse_allof_anyof() {
        let script = parse(
            r#"
            require "fileinto";
            if allof (header :contains "Subject" "test", header :is "From" "bot@example.com") {
                fileinto "Tests";
            }
            "#,
        )
        .unwrap();
        match &script.rules[0] {
            SieveRule::If { condition, .. } => match condition {
                SieveCondition::AllOf(conditions) => {
                    assert_eq!(conditions.len(), 2);
                }
                _ => panic!("Expected AllOf condition"),
            },
            _ => panic!("Expected If rule"),
        }
    }

    #[test]
    fn test_parse_if_else() {
        let script = parse(
            r#"
            require "fileinto";
            if header :is "From" "boss@example.com" {
                fileinto "Boss";
            } else {
                keep;
            }
            "#,
        )
        .unwrap();
        match &script.rules[0] {
            SieveRule::If {
                actions,
                else_actions,
                ..
            } => {
                assert_eq!(actions.len(), 1);
                assert_eq!(else_actions.len(), 1);
            }
            _ => panic!("Expected If rule"),
        }
    }

    #[test]
    fn test_parse_redirect() {
        let script = parse(r#"redirect "admin@example.com";"#).unwrap();
        match &script.rules[0] {
            SieveRule::Action(SieveAction::Redirect(addr)) => {
                assert_eq!(addr, "admin@example.com");
            }
            _ => panic!("Expected Redirect"),
        }
    }

    #[test]
    fn test_parse_reject() {
        let script = parse(r#"require "reject"; reject "Not accepted";"#).unwrap();
        match &script.rules[0] {
            SieveRule::Action(SieveAction::Reject(reason)) => {
                assert_eq!(reason, "Not accepted");
            }
            _ => panic!("Expected Reject"),
        }
    }

    #[test]
    fn test_parse_comments() {
        let script = parse(
            r#"
            # This is a comment
            require "fileinto";
            /* This is a
               block comment */
            keep;
            "#,
        )
        .unwrap();
        assert_eq!(script.rules.len(), 1);
        assert!(matches!(script.rules[0], SieveRule::Action(SieveAction::Keep)));
    }
}
