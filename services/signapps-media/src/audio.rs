//! Audio format conversion utilities.
//!
//! Converts any supported audio format to PCM f32 16kHz mono for STT,
//! and provides WAV encoding for TTS output.

/// Decode any audio format to PCM f32 samples at 16kHz mono.
#[cfg(feature = "native-stt")]
pub fn decode_to_pcm_f32(data: &[u8], _mime_type: &str) -> Result<Vec<f32>, AudioError> {
    use symphonia::core::audio::SampleBuffer;
    use symphonia::core::codecs::DecoderOptions;
    use symphonia::core::formats::FormatOptions;
    use symphonia::core::io::MediaSourceStream;
    use symphonia::core::meta::MetadataOptions;
    use symphonia::core::probe::Hint;

    let cursor = std::io::Cursor::new(data.to_vec());
    let mss = MediaSourceStream::new(Box::new(cursor), Default::default());

    let hint = Hint::new();
    let format_opts = FormatOptions::default();
    let metadata_opts = MetadataOptions::default();
    let decoder_opts = DecoderOptions::default();

    let probed = symphonia::default::get_probe()
        .format(&hint, mss, &format_opts, &metadata_opts)
        .map_err(|e| AudioError::DecodeError(format!("Probe failed: {}", e)))?;

    let mut format = probed.format;
    let track = format
        .default_track()
        .ok_or_else(|| AudioError::DecodeError("No audio track found".to_string()))?;

    let sample_rate = track
        .codec_params
        .sample_rate
        .ok_or_else(|| AudioError::DecodeError("Unknown sample rate".to_string()))?;

    let channels = track
        .codec_params
        .channels
        .map(|c| c.count())
        .unwrap_or(1);

    let mut decoder = symphonia::default::get_codecs()
        .make(&track.codec_params, &decoder_opts)
        .map_err(|e| AudioError::DecodeError(format!("Codec init failed: {}", e)))?;

    let track_id = track.id;
    let mut all_samples: Vec<f32> = Vec::new();

    loop {
        let packet = match format.next_packet() {
            Ok(packet) => packet,
            Err(symphonia::core::errors::Error::IoError(_)) => break, // EOF
            Err(e) => {
                tracing::warn!("Packet read error (continuing): {}", e);
                break;
            }
        };

        if packet.track_id() != track_id {
            continue;
        }

        let decoded = match decoder.decode(&packet) {
            Ok(decoded) => decoded,
            Err(e) => {
                tracing::warn!("Decode error (skipping packet): {}", e);
                continue;
            }
        };

        let spec = *decoded.spec();
        let num_frames = decoded.capacity();
        let mut sample_buf = SampleBuffer::<f32>::new(num_frames as u64, spec);
        sample_buf.copy_interleaved_ref(decoded);

        let samples = sample_buf.samples();

        // Convert to mono if stereo
        if channels > 1 {
            for chunk in samples.chunks(channels) {
                let mono: f32 = chunk.iter().sum::<f32>() / channels as f32;
                all_samples.push(mono);
            }
        } else {
            all_samples.extend_from_slice(samples);
        }
    }

    // Resample to 16kHz if needed
    if sample_rate != 16000 {
        all_samples = resample(&all_samples, sample_rate, 16000);
    }

    Ok(all_samples)
}

/// Simple linear resampling.
#[cfg(feature = "native-stt")]
fn resample(samples: &[f32], from_rate: u32, to_rate: u32) -> Vec<f32> {
    if from_rate == to_rate || samples.is_empty() {
        return samples.to_vec();
    }

    let ratio = from_rate as f64 / to_rate as f64;
    let output_len = (samples.len() as f64 / ratio) as usize;
    let mut output = Vec::with_capacity(output_len);

    for i in 0..output_len {
        let src_idx = i as f64 * ratio;
        let idx = src_idx as usize;
        let frac = (src_idx - idx as f64) as f32;

        let sample = if idx + 1 < samples.len() {
            samples[idx] * (1.0 - frac) + samples[idx + 1] * frac
        } else if idx < samples.len() {
            samples[idx]
        } else {
            0.0
        };
        output.push(sample);
    }

    output
}

/// Encode PCM i16 samples to WAV format bytes.
#[cfg(any(feature = "native-stt", feature = "native-tts"))]
pub fn encode_wav(samples: &[i16], sample_rate: u32, channels: u16) -> Result<Vec<u8>, AudioError> {
    let mut buffer = Vec::new();
    let cursor = std::io::Cursor::new(&mut buffer);

    let spec = hound::WavSpec {
        channels,
        sample_rate,
        bits_per_sample: 16,
        sample_format: hound::SampleFormat::Int,
    };

    let mut writer = hound::WavWriter::new(cursor, spec)
        .map_err(|e| AudioError::EncodeError(format!("WAV writer init failed: {}", e)))?;

    for &sample in samples {
        writer
            .write_sample(sample)
            .map_err(|e| AudioError::EncodeError(format!("WAV write failed: {}", e)))?;
    }

    writer
        .finalize()
        .map_err(|e| AudioError::EncodeError(format!("WAV finalize failed: {}", e)))?;

    Ok(buffer)
}

/// Encode PCM f32 samples to WAV format bytes (converts to i16 first).
#[cfg(any(feature = "native-stt", feature = "native-tts"))]
pub fn encode_wav_f32(
    samples: &[f32],
    sample_rate: u32,
    channels: u16,
) -> Result<Vec<u8>, AudioError> {
    let i16_samples: Vec<i16> = samples
        .iter()
        .map(|&s| {
            let clamped = s.clamp(-1.0, 1.0);
            (clamped * 32767.0) as i16
        })
        .collect();
    encode_wav(&i16_samples, sample_rate, channels)
}

#[derive(Debug, thiserror::Error)]
#[allow(dead_code)]
pub enum AudioError {
    #[error("Decode error: {0}")]
    DecodeError(String),

    #[error("Encode error: {0}")]
    EncodeError(String),

    #[error("Unsupported format: {0}")]
    UnsupportedFormat(String),
}
