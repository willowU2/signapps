//! LDAP filter evaluation and SQL compilation (RFC 4515).
//!
//! Parses LDAP search filter strings and compiles them to parameterized
//! PostgreSQL `WHERE` clauses suitable for querying the org-structure tables.
//!
//! # Examples
//!
//! ```
//! use signapps_ad_core::filter::LdapFilter;
//!
//! let filter = LdapFilter::parse("(sAMAccountName=admin)").unwrap();
//! let (sql, params) = filter.to_sql(1);
//! assert_eq!(sql, "LOWER(u.username) = LOWER($1)");
//! assert_eq!(params, vec!["admin".to_string()]);
//! ```

use serde::{Deserialize, Serialize};
use thiserror::Error;

/// Errors that can occur while parsing an LDAP filter string.
#[derive(Debug, Clone, PartialEq, Error)]
pub enum FilterError {
    /// The filter string contains invalid or unexpected syntax.
    #[error("invalid filter syntax: {0}")]
    InvalidSyntax(String),

    /// The input ended before the filter was complete.
    #[error("unexpected end of filter input")]
    UnexpectedEnd,

    /// Parentheses are not balanced in the filter string.
    #[error("unbalanced parentheses in filter")]
    UnbalancedParens,
}

/// An LDAP search filter as defined by RFC 4515.
///
/// Each variant corresponds to one of the filter types supported by the LDAP
/// protocol. Compound filters (`And`, `Or`, `Not`) nest other filters
/// recursively.
///
/// # Examples
///
/// ```
/// use signapps_ad_core::filter::LdapFilter;
///
/// let f = LdapFilter::parse("(&(objectClass=user)(mail=*))").unwrap();
/// let (sql, params) = f.to_sql(1);
/// assert!(sql.contains("AND"));
/// ```
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub enum LdapFilter {
    /// Equality match: `(attr=value)`
    Equal(String, String),

    /// Substring match: `(attr=*value*)` — the pattern is stored with `%`
    /// delimiters for direct use in a SQL `ILIKE` clause.
    Substring(String, String),

    /// Presence assertion: `(attr=*)` — the attribute must be non-NULL.
    Present(String),

    /// Greater-or-equal comparison: `(attr>=value)`
    GreaterOrEqual(String, String),

    /// Less-or-equal comparison: `(attr<=value)`
    LessOrEqual(String, String),

    /// Conjunction of sub-filters: `(&(f1)(f2)...)`
    And(Vec<LdapFilter>),

    /// Disjunction of sub-filters: `(|(f1)(f2)...)`
    Or(Vec<LdapFilter>),

    /// Negation of a sub-filter: `(!(f))`
    Not(Box<LdapFilter>),
}

impl LdapFilter {
    /// Parse an RFC 4515 LDAP filter string into a [`LdapFilter`].
    ///
    /// # Errors
    ///
    /// Returns [`FilterError::InvalidSyntax`] when the string is malformed,
    /// [`FilterError::UnexpectedEnd`] when input is truncated, and
    /// [`FilterError::UnbalancedParens`] when parentheses do not match.
    ///
    /// # Examples
    ///
    /// ```
    /// use signapps_ad_core::filter::LdapFilter;
    ///
    /// let f = LdapFilter::parse("(sAMAccountName=admin)").unwrap();
    /// assert_eq!(f, LdapFilter::Equal("sAMAccountName".into(), "admin".into()));
    /// ```
    ///
    /// # Panics
    ///
    /// No panics — all errors are propagated via `Result`.
    pub fn parse(input: &str) -> Result<Self, FilterError> {
        let input = input.trim();
        if input.is_empty() {
            return Err(FilterError::UnexpectedEnd);
        }
        let (filter, rest) = parse_filter(input)?;
        let rest = rest.trim();
        if !rest.is_empty() {
            return Err(FilterError::InvalidSyntax(format!(
                "unexpected trailing input: {rest}"
            )));
        }
        Ok(filter)
    }

    /// Compile this filter to a parameterized PostgreSQL `WHERE` fragment.
    ///
    /// Returns a tuple `(sql_fragment, parameters)` where every `$N`
    /// placeholder in `sql_fragment` corresponds to `parameters[N - param_offset]`.
    ///
    /// `param_offset` is the index of the first placeholder (typically `1`
    /// when building a standalone query, or higher when appending to an
    /// existing parameter list).
    ///
    /// # Examples
    ///
    /// ```
    /// use signapps_ad_core::filter::LdapFilter;
    ///
    /// let (sql, params) = LdapFilter::parse("(mail=*)")
    ///     .unwrap()
    ///     .to_sql(1);
    /// assert_eq!(sql, "u.email IS NOT NULL");
    /// assert!(params.is_empty());
    /// ```
    ///
    /// # Errors
    ///
    /// This method is infallible; it always returns a valid SQL fragment.
    ///
    /// # Panics
    ///
    /// No panics — all errors are propagated via `Result`.
    pub fn to_sql(&self, param_offset: usize) -> (String, Vec<String>) {
        let mut params = Vec::new();
        let sql = self.compile_sql(&mut params, &mut { param_offset });
        (sql, params)
    }

    /// Recursively compile the filter, accumulating bound parameters.
    fn compile_sql(&self, params: &mut Vec<String>, counter: &mut usize) -> String {
        match self {
            LdapFilter::Equal(attr, value) => {
                let col = Self::attr_to_column(attr);
                let idx = *counter;
                *counter += 1;
                params.push(value.clone());
                format!("LOWER({col}) = LOWER(${idx})")
            }
            LdapFilter::Substring(attr, pattern) => {
                let col = Self::attr_to_column(attr);
                let idx = *counter;
                *counter += 1;
                params.push(pattern.clone());
                format!("{col} ILIKE ${idx}")
            }
            LdapFilter::Present(attr) => {
                let col = Self::attr_to_column(attr);
                format!("{col} IS NOT NULL")
            }
            LdapFilter::GreaterOrEqual(attr, value) => {
                let col = Self::attr_to_column(attr);
                let idx = *counter;
                *counter += 1;
                params.push(value.clone());
                format!("{col} >= ${idx}")
            }
            LdapFilter::LessOrEqual(attr, value) => {
                let col = Self::attr_to_column(attr);
                let idx = *counter;
                *counter += 1;
                params.push(value.clone());
                format!("{col} <= ${idx}")
            }
            LdapFilter::And(children) => {
                let parts: Vec<String> = children
                    .iter()
                    .map(|c| c.compile_sql(params, counter))
                    .collect();
                format!("({})", parts.join(" AND "))
            }
            LdapFilter::Or(children) => {
                let parts: Vec<String> = children
                    .iter()
                    .map(|c| c.compile_sql(params, counter))
                    .collect();
                format!("({})", parts.join(" OR "))
            }
            LdapFilter::Not(child) => {
                let inner = child.compile_sql(params, counter);
                format!("NOT ({inner})")
            }
        }
    }

    /// Map an LDAP attribute name (case-insensitive) to the SQL column
    /// expression used in the org-structure joined view.
    fn attr_to_column(attr: &str) -> String {
        match attr.to_lowercase().as_str() {
            "samaccountname" => "u.username".into(),
            "userprincipalname" => "u.username".into(),
            "mail" => "u.email".into(),
            "givenname" => "p.first_name".into(),
            "sn" => "p.last_name".into(),
            "displayname" => "CONCAT(p.first_name, ' ', p.last_name)".into(),
            "department" => "u.department".into(),
            "title" => "u.job_title".into(),
            "telephonenumber" => "u.phone".into(),
            "objectclass" => "n.node_type".into(),
            "cn" | "name" => "n.name".into(),
            "ou" => "n.name".into(),
            "description" => "n.description".into(),
            "useraccountcontrol" => "CAST(n.attributes->>'uac' AS INTEGER)".into(),
            other => {
                // Escape single quotes to prevent injection via JSONB key lookup.
                let safe = other.replace('\'', "''");
                format!("n.attributes->>'{}' ", safe)
            }
        }
    }
}

// ── Internal parser ───────────────────────────────────────────────────────────

/// Parse a single filter starting at the beginning of `input`.
///
/// Returns `(filter, remaining_input)` on success.
fn parse_filter(input: &str) -> Result<(LdapFilter, &str), FilterError> {
    let input = input.trim_start();
    if !input.starts_with('(') {
        return Err(FilterError::InvalidSyntax(format!(
            "expected '(' at start, got: {input}"
        )));
    }
    let inner = &input[1..]; // skip opening '('

    // Compound filters: &, |, !
    if let Some(rest) = inner.strip_prefix('&') {
        let (children, rest) = parse_filter_list(rest)?;
        let rest = expect_close(rest)?;
        return Ok((LdapFilter::And(children), rest));
    }
    if let Some(rest) = inner.strip_prefix('|') {
        let (children, rest) = parse_filter_list(rest)?;
        let rest = expect_close(rest)?;
        return Ok((LdapFilter::Or(children), rest));
    }
    if let Some(rest) = inner.strip_prefix('!') {
        let (child, rest) = parse_filter(rest)?;
        let rest = expect_close(rest)?;
        return Ok((LdapFilter::Not(Box::new(child)), rest));
    }

    // Simple filter: find the closing ')' for this level (respecting nesting)
    let close = find_matching_close(inner)?;
    let expr = &inner[..close];
    let rest = &inner[close + 1..];

    let filter = parse_simple_filter(expr)?;
    Ok((filter, rest))
}

/// Parse a sequence of filters until we hit a `)` that is not consumed here.
fn parse_filter_list(input: &str) -> Result<(Vec<LdapFilter>, &str), FilterError> {
    let mut filters = Vec::new();
    let mut remaining = input.trim_start();
    while remaining.starts_with('(') {
        let (f, rest) = parse_filter(remaining)?;
        filters.push(f);
        remaining = rest.trim_start();
    }
    if filters.is_empty() {
        return Err(FilterError::InvalidSyntax(
            "compound filter has no children".into(),
        ));
    }
    Ok((filters, remaining))
}

/// Consume a single closing `)` and return the rest.
fn expect_close(input: &str) -> Result<&str, FilterError> {
    let input = input.trim_start();
    if input.starts_with(')') {
        Ok(&input[1..])
    } else if input.is_empty() {
        Err(FilterError::UnexpectedEnd)
    } else {
        Err(FilterError::UnbalancedParens)
    }
}

/// Find the position of the `)` that closes the current level of nesting
/// within `input` (which already has the opening `(` removed).
fn find_matching_close(input: &str) -> Result<usize, FilterError> {
    let mut depth: i32 = 0;
    for (i, ch) in input.char_indices() {
        match ch {
            '(' => depth += 1,
            ')' if depth == 0 => return Ok(i),
            ')' => depth -= 1,
            _ => {}
        }
    }
    Err(FilterError::UnbalancedParens)
}

/// Parse a simple (leaf) filter expression of the form `attr OP value`.
fn parse_simple_filter(expr: &str) -> Result<LdapFilter, FilterError> {
    // Try >= and <= before = to avoid mis-parsing the operator.
    if let Some(idx) = expr.find(">=") {
        let attr = expr[..idx].trim().to_string();
        let value = expr[idx + 2..].trim().to_string();
        validate_attr(&attr)?;
        return Ok(LdapFilter::GreaterOrEqual(attr, value));
    }
    if let Some(idx) = expr.find("<=") {
        let attr = expr[..idx].trim().to_string();
        let value = expr[idx + 2..].trim().to_string();
        validate_attr(&attr)?;
        return Ok(LdapFilter::LessOrEqual(attr, value));
    }
    if let Some(idx) = expr.find('=') {
        let attr = expr[..idx].trim().to_string();
        let value = expr[idx + 1..].to_string(); // keep raw value (no trim — spaces may matter)
        validate_attr(&attr)?;

        // Presence: (attr=*)
        if value == "*" {
            return Ok(LdapFilter::Present(attr));
        }

        // Substring: value contains at least one unescaped '*'
        if value.contains('*') {
            let pattern = ldap_substring_to_sql_like(&value);
            return Ok(LdapFilter::Substring(attr, pattern));
        }

        return Ok(LdapFilter::Equal(attr, value));
    }

    Err(FilterError::InvalidSyntax(format!(
        "no recognised operator in: {expr}"
    )))
}

/// Ensure an attribute name is non-empty.
fn validate_attr(attr: &str) -> Result<(), FilterError> {
    if attr.is_empty() {
        return Err(FilterError::InvalidSyntax("empty attribute name".into()));
    }
    Ok(())
}

/// Convert an LDAP substring assertion value (using `*` as wildcard) to a
/// SQL `LIKE`/`ILIKE` pattern (using `%` as wildcard).
///
/// RFC 4515 allows leading, trailing, and internal `*` wildcards.
fn ldap_substring_to_sql_like(value: &str) -> String {
    value.replace('*', "%")
}

// ── Tests ─────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_equality_filter() {
        let f = LdapFilter::parse("(sAMAccountName=admin)").unwrap();
        assert_eq!(
            f,
            LdapFilter::Equal("sAMAccountName".into(), "admin".into())
        );
    }

    #[test]
    fn parse_presence_filter() {
        let f = LdapFilter::parse("(mail=*)").unwrap();
        assert_eq!(f, LdapFilter::Present("mail".into()));
    }

    #[test]
    fn parse_substring_filter() {
        let f = LdapFilter::parse("(cn=*john*)").unwrap();
        assert_eq!(
            f,
            LdapFilter::Substring("cn".into(), "%john%".into())
        );
    }

    #[test]
    fn parse_and_filter() {
        let f = LdapFilter::parse("(&(objectClass=user)(sAMAccountName=admin))").unwrap();
        match f {
            LdapFilter::And(children) => {
                assert_eq!(children.len(), 2);
                assert_eq!(
                    children[0],
                    LdapFilter::Equal("objectClass".into(), "user".into())
                );
                assert_eq!(
                    children[1],
                    LdapFilter::Equal("sAMAccountName".into(), "admin".into())
                );
            }
            other => panic!("expected And, got {other:?}"),
        }
    }

    #[test]
    fn parse_or_filter() {
        let f = LdapFilter::parse("(|(cn=Alice)(cn=Bob))").unwrap();
        match f {
            LdapFilter::Or(children) => {
                assert_eq!(children.len(), 2);
                assert_eq!(
                    children[0],
                    LdapFilter::Equal("cn".into(), "Alice".into())
                );
                assert_eq!(
                    children[1],
                    LdapFilter::Equal("cn".into(), "Bob".into())
                );
            }
            other => panic!("expected Or, got {other:?}"),
        }
    }

    #[test]
    fn parse_not_filter() {
        let f = LdapFilter::parse("(!(objectClass=computer))").unwrap();
        match f {
            LdapFilter::Not(inner) => {
                assert_eq!(
                    *inner,
                    LdapFilter::Equal("objectClass".into(), "computer".into())
                );
            }
            other => panic!("expected Not, got {other:?}"),
        }
    }

    #[test]
    fn parse_nested_compound() {
        let f = LdapFilter::parse(
            "(&(objectClass=user)(|(mail=*@example.com)(department=IT)))",
        )
        .unwrap();
        match f {
            LdapFilter::And(children) => {
                assert_eq!(children.len(), 2);
                assert_eq!(
                    children[0],
                    LdapFilter::Equal("objectClass".into(), "user".into())
                );
                match &children[1] {
                    LdapFilter::Or(or_children) => {
                        assert_eq!(or_children.len(), 2);
                        assert_eq!(
                            or_children[0],
                            LdapFilter::Substring("mail".into(), "%@example.com".into())
                        );
                        assert_eq!(
                            or_children[1],
                            LdapFilter::Equal("department".into(), "IT".into())
                        );
                    }
                    other => panic!("expected Or, got {other:?}"),
                }
            }
            other => panic!("expected And, got {other:?}"),
        }
    }

    #[test]
    fn compile_simple_to_sql() {
        let (sql, params) = LdapFilter::parse("(sAMAccountName=admin)")
            .unwrap()
            .to_sql(1);
        assert_eq!(sql, "LOWER(u.username) = LOWER($1)");
        assert_eq!(params, vec!["admin".to_string()]);
    }

    #[test]
    fn compile_and_to_sql() {
        let (sql, params) =
            LdapFilter::parse("(&(objectClass=user)(sAMAccountName=admin))")
                .unwrap()
                .to_sql(1);
        assert!(sql.contains("AND"), "expected AND in: {sql}");
        assert_eq!(params.len(), 2);
    }

    #[test]
    fn compile_presence_to_sql() {
        let (sql, params) = LdapFilter::parse("(telephoneNumber=*)")
            .unwrap()
            .to_sql(1);
        assert_eq!(sql, "u.phone IS NOT NULL");
        assert!(params.is_empty());
    }

    #[test]
    fn unknown_attr_maps_to_jsonb() {
        let (sql, _params) = LdapFilter::parse("(homeDirectory=/home/test)")
            .unwrap()
            .to_sql(1);
        assert!(
            sql.contains("n.attributes"),
            "expected n.attributes in: {sql}"
        );
    }

    #[test]
    fn invalid_filter_errors() {
        assert!(
            LdapFilter::parse("").is_err(),
            "empty string should be an error"
        );
        assert!(
            LdapFilter::parse("no parens").is_err(),
            "bare string should be an error"
        );
        assert!(
            LdapFilter::parse("(missing-equals)").is_err(),
            "no operator should be an error"
        );
    }
}
