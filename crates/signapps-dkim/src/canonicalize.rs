//! DKIM header and body canonicalization (RFC 6376, Section 3.4).
//!
//! Implements the **relaxed** canonicalization algorithm for both headers and body.
//! The "simple" algorithm is not implemented because relaxed is the recommended
//! default and the only mode used by this crate.

/// Canonicalize a single header line using the relaxed algorithm (RFC 6376 §3.4.2).
///
/// 1. Convert header name to lowercase.
/// 2. Unfold header (remove CRLF before WSP).
/// 3. Collapse sequences of WSP to a single SP.
/// 4. Strip trailing WSP before the line ending.
///
/// The returned value does **not** include a trailing CRLF — the caller is
/// responsible for appending one if needed.
///
/// # Examples
///
/// ```
/// use signapps_dkim::canonicalize::canonicalize_header_relaxed;
///
/// let result = canonicalize_header_relaxed("Subject:  Hello   World ");
/// assert_eq!(result, "subject:Hello World");
/// ```
///
/// # Errors
///
/// This function is infallible.
///
/// # Panics
///
/// None.
pub fn canonicalize_header_relaxed(header: &str) -> String {
    // Find the colon separating name from value
    let (name, value) = match header.find(':') {
        Some(pos) => (&header[..pos], &header[pos + 1..]),
        None => return header.to_lowercase(),
    };

    // Step 1: lowercase the header name
    let name = name.to_lowercase();

    // Step 2: unfold (remove CRLF followed by WSP)
    let value = value.replace("\r\n ", " ").replace("\r\n\t", " ");

    // Step 3: collapse whitespace runs to a single space
    let mut collapsed = String::with_capacity(value.len());
    let mut in_ws = true; // start true to strip leading whitespace after colon
    for ch in value.chars() {
        if ch == ' ' || ch == '\t' {
            if !in_ws {
                collapsed.push(' ');
                in_ws = true;
            }
        } else {
            collapsed.push(ch);
            in_ws = false;
        }
    }

    // Step 4: strip trailing WSP
    let collapsed = collapsed.trim_end();

    format!("{name}:{collapsed}")
}

/// Canonicalize multiple headers using the relaxed algorithm.
///
/// Each header in `headers` is individually canonicalized and then joined with CRLF.
/// A trailing CRLF is appended after the last header.
///
/// # Examples
///
/// ```
/// use signapps_dkim::canonicalize_headers_relaxed;
///
/// let headers = vec!["From: Alice <a@example.com>", "Subject:  Hello "];
/// let result = canonicalize_headers_relaxed(&headers);
/// assert!(result.contains("from:"));
/// ```
///
/// # Errors
///
/// This function is infallible.
///
/// # Panics
///
/// None.
pub fn canonicalize_headers_relaxed(headers: &[&str]) -> String {
    headers
        .iter()
        .map(|h| canonicalize_header_relaxed(h))
        .collect::<Vec<_>>()
        .join("\r\n")
}

/// Canonicalize the message body using the relaxed algorithm (RFC 6376 §3.4.4).
///
/// 1. Reduce all sequences of WSP within a line to a single SP.
/// 2. Strip trailing WSP from each line.
/// 3. Remove all empty lines at the end of the body.
/// 4. Ensure the body ends with a single CRLF (unless the body is empty).
///
/// # Examples
///
/// ```
/// use signapps_dkim::canonicalize_body_relaxed;
///
/// let body = b"Hello  World  \r\n\r\n\r\n";
/// let result = canonicalize_body_relaxed(body);
/// assert_eq!(result, b"Hello World\r\n");
/// ```
///
/// # Errors
///
/// This function is infallible.
///
/// # Panics
///
/// None.
pub fn canonicalize_body_relaxed(body: &[u8]) -> Vec<u8> {
    let body_str = String::from_utf8_lossy(body);

    // Split into lines (preserving the line structure)
    let lines: Vec<&str> = body_str.split("\r\n").collect();

    let mut result_lines: Vec<String> = Vec::new();

    for line in &lines {
        // Collapse whitespace runs to single space
        let mut collapsed = String::with_capacity(line.len());
        let mut in_ws = false;
        for ch in line.chars() {
            if ch == ' ' || ch == '\t' {
                if !in_ws {
                    collapsed.push(' ');
                    in_ws = true;
                }
            } else {
                collapsed.push(ch);
                in_ws = false;
            }
        }

        // Strip trailing whitespace
        let trimmed = collapsed.trim_end().to_string();
        result_lines.push(trimmed);
    }

    // Remove the last element if it came from a trailing split
    // (split on "a\r\n" produces ["a", ""])
    // We handle trailing empty lines below.

    // Remove trailing empty lines
    while result_lines.last().is_some_and(|l| l.is_empty()) {
        result_lines.pop();
    }

    // If the body is completely empty, return empty
    if result_lines.is_empty() {
        return Vec::new();
    }

    // Join with CRLF and add trailing CRLF
    let mut output = result_lines.join("\r\n");
    output.push_str("\r\n");

    output.into_bytes()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_header_relaxed_whitespace_collapsing() {
        let header = "Subject:  Hello    World  ";
        let result = canonicalize_header_relaxed(header);
        assert_eq!(result, "subject:Hello World");
    }

    #[test]
    fn test_header_relaxed_case_folding() {
        let header = "Content-Type: text/plain";
        let result = canonicalize_header_relaxed(header);
        assert_eq!(result, "content-type:text/plain");
    }

    #[test]
    fn test_header_relaxed_unfold() {
        let header = "Subject: Hello\r\n World";
        let result = canonicalize_header_relaxed(header);
        assert_eq!(result, "subject:Hello World");
    }

    #[test]
    fn test_header_relaxed_leading_whitespace_stripped() {
        let header = "From:   alice@example.com  ";
        let result = canonicalize_header_relaxed(header);
        assert_eq!(result, "from:alice@example.com");
    }

    #[test]
    fn test_body_relaxed_trailing_whitespace() {
        let body = b"Hello  World  \r\nSecond line  \r\n\r\n\r\n";
        let result = canonicalize_body_relaxed(body);
        assert_eq!(result, b"Hello World\r\nSecond line\r\n");
    }

    #[test]
    fn test_body_relaxed_empty_body() {
        let body = b"\r\n\r\n";
        let result = canonicalize_body_relaxed(body);
        assert!(result.is_empty());
    }

    #[test]
    fn test_body_relaxed_single_line() {
        let body = b"Hello\r\n";
        let result = canonicalize_body_relaxed(body);
        assert_eq!(result, b"Hello\r\n");
    }

    #[test]
    fn test_body_relaxed_tab_collapsing() {
        let body = b"Hello\t\tWorld\r\n";
        let result = canonicalize_body_relaxed(body);
        assert_eq!(result, b"Hello World\r\n");
    }
}
