use std::collections::HashMap;

/// Tokenize text into lowercase words, filtering out noise.
pub fn tokenize(text: &str) -> Vec<String> {
    text.to_lowercase()
        .split(|c: char| !c.is_alphanumeric() && c != '\'')
        .filter(|w| w.len() >= 3 && w.len() <= 40)
        .map(|w| w.to_string())
        .collect()
}

/// Compute P(spam | words) using Naive Bayes with Laplace smoothing.
pub fn naive_bayes_classify(
    word_counts: &HashMap<String, (i32, i32)>,
    words: &[String],
    total_spam: i32,
    total_ham: i32,
    vocab_size: usize,
) -> (f64, f64) {
    let total = (total_spam + total_ham) as f64;
    if total == 0.0 {
        return (0.5, 0.5);
    }

    let p_spam = (total_spam as f64) / total;
    let p_ham = (total_ham as f64) / total;

    // Use log probabilities to avoid underflow
    let mut log_p_spam = p_spam.ln();
    let mut log_p_ham = p_ham.ln();

    let vocab = vocab_size as f64;

    for word in words {
        let (spam_count, ham_count) = word_counts.get(word).copied().unwrap_or((0, 0));

        // Laplace smoothing
        let p_word_spam = (spam_count as f64 + 1.0) / (total_spam as f64 + vocab);
        let p_word_ham = (ham_count as f64 + 1.0) / (total_ham as f64 + vocab);

        log_p_spam += p_word_spam.ln();
        log_p_ham += p_word_ham.ln();
    }

    // Convert back from log-space using log-sum-exp
    let max_log = log_p_spam.max(log_p_ham);
    let sum = (log_p_spam - max_log).exp() + (log_p_ham - max_log).exp();

    let spam_prob = (log_p_spam - max_log).exp() / sum;
    let ham_prob = (log_p_ham - max_log).exp() / sum;

    (spam_prob, ham_prob)
}

// ============================================================================
// Unit tests
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_tokenize_splits_words_correctly() {
        let words = tokenize("Hello World foo");
        assert!(words.contains(&"hello".to_string()));
        assert!(words.contains(&"world".to_string()));
        assert!(words.contains(&"foo".to_string()));
    }

    #[test]
    fn test_tokenize_lowercases_text() {
        let words = tokenize("SPAM Email Subject");
        assert!(words.contains(&"spam".to_string()));
        assert!(words.contains(&"email".to_string()));
        assert!(words.contains(&"subject".to_string()));
    }

    #[test]
    fn test_tokenize_filters_short_words() {
        // Words shorter than 3 chars should be filtered out
        let words = tokenize("hi to do it is a");
        assert!(words.is_empty() || words.iter().all(|w| w.len() >= 3));
    }

    #[test]
    fn test_tokenize_filters_long_words() {
        // Words longer than 40 chars should be filtered out
        let long_word = "a".repeat(50);
        let text = format!("normal {}", long_word);
        let words = tokenize(&text);
        assert!(words.iter().all(|w| w.len() <= 40));
    }

    #[test]
    fn test_tokenize_handles_punctuation() {
        let words = tokenize("hello, world! buy now.");
        assert!(words.contains(&"hello".to_string()));
        assert!(words.contains(&"world".to_string()));
    }

    #[test]
    fn test_tokenize_empty_string() {
        let words = tokenize("");
        assert!(words.is_empty());
    }

    #[test]
    fn test_naive_bayes_classify_no_training_data_returns_half() {
        // With no training data (totals = 0), both probabilities should be 0.5
        let word_counts = HashMap::new();
        let words = vec!["buy".to_string(), "now".to_string()];
        let (spam_prob, ham_prob) = naive_bayes_classify(&word_counts, &words, 0, 0, 10);
        assert!((spam_prob - 0.5).abs() < 1e-9);
        assert!((ham_prob - 0.5).abs() < 1e-9);
    }

    #[test]
    fn test_naive_bayes_classify_known_spam_words() {
        // Seed the model with clearly spammy word counts
        let mut word_counts = HashMap::new();
        word_counts.insert("buy".to_string(), (100, 1)); // (spam_count, ham_count)
        word_counts.insert("now".to_string(), (80, 2));
        word_counts.insert("cheap".to_string(), (90, 1));

        let words = vec!["buy".to_string(), "now".to_string(), "cheap".to_string()];
        let (spam_prob, _ham_prob) = naive_bayes_classify(&word_counts, &words, 200, 50, 100);
        assert!(
            spam_prob > 0.5,
            "Spam words should yield spam_prob > 0.5, got {}",
            spam_prob
        );
    }

    #[test]
    fn test_naive_bayes_classify_known_ham_words() {
        // Seed the model with clearly ham word counts
        let mut word_counts = HashMap::new();
        word_counts.insert("meeting".to_string(), (1, 100));
        word_counts.insert("agenda".to_string(), (2, 80));

        let words = vec!["meeting".to_string(), "agenda".to_string()];
        let (_spam_prob, ham_prob) = naive_bayes_classify(&word_counts, &words, 50, 200, 100);
        assert!(
            ham_prob > 0.5,
            "Ham words should yield ham_prob > 0.5, got {}",
            ham_prob
        );
    }

    #[test]
    fn test_naive_bayes_probabilities_sum_to_one() {
        let mut word_counts = HashMap::new();
        word_counts.insert("test".to_string(), (10, 5));

        let words = vec!["test".to_string()];
        let (spam_prob, ham_prob) = naive_bayes_classify(&word_counts, &words, 100, 100, 50);
        let sum = spam_prob + ham_prob;
        assert!(
            (sum - 1.0).abs() < 1e-9,
            "Probabilities must sum to 1.0, got {}",
            sum
        );
    }
}
