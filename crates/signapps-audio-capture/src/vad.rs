//! Voice Activity Detection by RMS energy.

/// Check if an audio chunk contains speech based on RMS energy.
///
/// Computes the root-mean-square of `samples` and compares against
/// `threshold`. Returns `true` if the RMS exceeds the threshold,
/// indicating likely speech activity.
///
/// # Examples
///
/// ```
/// use signapps_audio_capture::vad::{is_speech, DEFAULT_RMS_THRESHOLD};
///
/// let silence = vec![0i16; 1600];
/// assert!(!is_speech(&silence, DEFAULT_RMS_THRESHOLD));
/// ```
pub fn is_speech(samples: &[i16], threshold: f32) -> bool {
    if samples.is_empty() {
        return false;
    }
    let sum_sq: f64 = samples.iter().map(|&s| (s as f64).powi(2)).sum();
    let rms = (sum_sq / samples.len() as f64).sqrt();
    rms > threshold as f64
}

/// Default RMS threshold for speech detection.
pub const DEFAULT_RMS_THRESHOLD: f32 = 500.0;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn silence_detected() {
        let silence = vec![0i16; 1600];
        assert!(!is_speech(&silence, DEFAULT_RMS_THRESHOLD));
    }

    #[test]
    fn speech_detected() {
        let loud: Vec<i16> = (0..1600)
            .map(|i| ((i as f32 * 0.1).sin() * 10000.0) as i16)
            .collect();
        assert!(is_speech(&loud, DEFAULT_RMS_THRESHOLD));
    }

    #[test]
    fn empty_is_silence() {
        assert!(!is_speech(&[], DEFAULT_RMS_THRESHOLD));
    }
}
