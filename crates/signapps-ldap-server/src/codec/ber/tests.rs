#[cfg(test)]
mod ber_roundtrip {
    use super::super::types::{BerData, BerError, BerTag};
    use super::super::{
        decode, decode_all, decode_boolean, decode_enumerated, decode_integer, decode_octet_string,
        encode, encode_boolean, encode_context, encode_enumerated, encode_integer,
        encode_octet_string, encode_sequence,
    };

    // ── 1. INTEGER round-trip ─────────────────────────────────────────────────

    #[test]
    fn encode_decode_integer() {
        let cases: &[i64] = &[
            0,
            1,
            -1,
            127,
            128,
            256,
            -128,
            -129,
            i32::MAX as i64,
            i32::MIN as i64,
            i64::MAX,
            i64::MIN,
        ];
        for &value in cases {
            let elem = encode_integer(value);
            let bytes = encode(&elem);
            let (decoded, rest) = decode(&bytes).expect("decode should succeed");
            assert_eq!(rest, b"", "no leftover bytes for value {value}");
            assert_eq!(
                decode_integer(&decoded).expect("decode_integer should succeed"),
                value,
                "round-trip failed for {value}"
            );
        }
    }

    // ── 2. OCTET STRING round-trip ────────────────────────────────────────────

    #[test]
    fn encode_decode_octet_string() {
        let cases: &[&[u8]] = &[b"", b"hello", b"world", &[0x00, 0xFF, 0x80, 0x7F]];
        for &value in cases {
            let elem = encode_octet_string(value);
            let bytes = encode(&elem);
            let (decoded, rest) = decode(&bytes).expect("decode should succeed");
            assert_eq!(rest, b"");
            assert_eq!(
                decode_octet_string(&decoded).expect("decode_octet_string should succeed"),
                value
            );
        }
    }

    // ── 3. BOOLEAN round-trip ─────────────────────────────────────────────────

    #[test]
    fn encode_decode_boolean() {
        for &value in &[true, false] {
            let elem = encode_boolean(value);
            let bytes = encode(&elem);
            let (decoded, rest) = decode(&bytes).expect("decode should succeed");
            assert_eq!(rest, b"");
            assert_eq!(
                decode_boolean(&decoded).expect("decode_boolean should succeed"),
                value
            );
        }
        // BER: any non-zero byte is true.
        let raw = [0x01, 0x01, 0x42u8];
        let (elem, _) = decode(&raw).unwrap();
        assert!(decode_boolean(&elem).unwrap());
    }

    // ── 4. ENUMERATED round-trip ──────────────────────────────────────────────

    #[test]
    fn encode_decode_enumerated() {
        for &value in &[0i32, 1, 3, 127, -1] {
            let elem = encode_enumerated(value);
            let bytes = encode(&elem);
            let (decoded, rest) = decode(&bytes).expect("decode should succeed");
            assert_eq!(rest, b"");
            assert_eq!(
                decode_enumerated(&decoded).expect("decode_enumerated should succeed"),
                value
            );
        }
    }

    // ── 5. SEQUENCE round-trip ────────────────────────────────────────────────

    #[test]
    fn encode_decode_sequence() {
        let children = vec![encode_integer(1), encode_octet_string(b"test")];
        let seq = encode_sequence(children.clone());
        let bytes = encode(&seq);

        let (decoded, rest) = decode(&bytes).expect("decode should succeed");
        assert_eq!(rest, b"");
        assert_eq!(decoded.tag, BerTag::Sequence);

        if let BerData::Constructed(decoded_children) = &decoded.data {
            assert_eq!(decoded_children.len(), 2);
            assert_eq!(decode_integer(&decoded_children[0]).unwrap(), 1);
            assert_eq!(decode_octet_string(&decoded_children[1]).unwrap(), b"test");
        } else {
            panic!("expected Constructed data");
        }
    }

    // ── 6. Context tag round-trip ─────────────────────────────────────────────

    #[test]
    fn encode_decode_context_tag() {
        // [0] CONSTRUCTED containing an INTEGER
        let inner = encode_integer(42);
        let ctx = encode_context(0, true, BerData::Constructed(vec![inner]));
        let bytes = encode(&ctx);

        let (decoded, rest) = decode(&bytes).expect("decode should succeed");
        assert_eq!(rest, b"");
        assert_eq!(
            decoded.tag,
            BerTag::Context {
                number: 0,
                constructed: true
            }
        );
        if let BerData::Constructed(children) = &decoded.data {
            assert_eq!(decode_integer(&children[0]).unwrap(), 42);
        } else {
            panic!("expected Constructed");
        }

        // [1] PRIMITIVE with raw bytes
        let ctx_prim = encode_context(1, false, BerData::Primitive(vec![0xDE, 0xAD]));
        let prim_bytes = encode(&ctx_prim);
        let (decoded_prim, _) = decode(&prim_bytes).unwrap();
        assert_eq!(
            decoded_prim.tag,
            BerTag::Context {
                number: 1,
                constructed: false
            }
        );
        assert_eq!(decoded_prim.data, BerData::Primitive(vec![0xDE, 0xAD]));
    }

    // ── 7. Multi-byte length field ────────────────────────────────────────────

    #[test]
    fn decode_multi_byte_length() {
        // Build an OCTET STRING with 200 bytes — length field needs long form.
        let data: Vec<u8> = (0u8..200).collect();
        let elem = encode_octet_string(&data);
        let bytes = encode(&elem);

        // Verify the length is encoded in long form (0x81, 0xC8).
        assert_eq!(bytes[1], 0x81, "length should be long form");
        assert_eq!(bytes[2], 200u8);

        let (decoded, rest) = decode(&bytes).expect("decode should succeed");
        assert_eq!(rest, b"");
        assert_eq!(decode_octet_string(&decoded).unwrap(), data.as_slice());
    }

    // ── 8. Empty input returns UnexpectedEnd ──────────────────────────────────

    #[test]
    fn decode_empty_input_error() {
        let result = decode(b"");
        assert!(
            matches!(result, Err(BerError::UnexpectedEnd)),
            "expected UnexpectedEnd, got {result:?}"
        );
    }

    // ── 9. Truncated data returns error ───────────────────────────────────────

    #[test]
    fn decode_truncated_error() {
        // Tag + length say 5 bytes of content, but only 2 are present.
        let truncated = [0x04u8, 0x05, 0x41, 0x42];
        let result = decode(&truncated);
        assert!(
            matches!(result, Err(BerError::UnexpectedEnd)),
            "expected UnexpectedEnd for truncated input, got {result:?}"
        );
    }

    // ── 10. INTEGER uses minimal bytes ────────────────────────────────────────

    #[test]
    fn encode_integer_minimal_bytes() {
        use super::super::encoder::encode_integer as enc_int;
        // Access integer_to_bytes indirectly via encode_integer + encode
        // 0 → 1 byte: 02 01 00
        assert_eq!(encode(&enc_int(0)), [0x02, 0x01, 0x00]);
        // 127 → 1 byte: 02 01 7F
        assert_eq!(encode(&enc_int(127)), [0x02, 0x01, 0x7F]);
        // 128 → 2 bytes: 02 02 00 80
        assert_eq!(encode(&enc_int(128)), [0x02, 0x02, 0x00, 0x80]);
        // -1 → 1 byte: 02 01 FF
        assert_eq!(encode(&enc_int(-1)), [0x02, 0x01, 0xFF]);
        // -128 → 1 byte: 02 01 80
        assert_eq!(encode(&enc_int(-128)), [0x02, 0x01, 0x80]);
        // -129 → 2 bytes: 02 02 FF 7F
        assert_eq!(encode(&enc_int(-129)), [0x02, 0x02, 0xFF, 0x7F]);
        // 256 → 2 bytes: 02 02 01 00
        assert_eq!(encode(&enc_int(256)), [0x02, 0x02, 0x01, 0x00]);
    }

    // ── 11. decode_all consumes the entire buffer ─────────────────────────────

    #[test]
    fn decode_all_multiple_elements() {
        let mut buf = encode(&encode_integer(10));
        buf.extend(encode(&encode_boolean(false)));
        buf.extend(encode(&encode_octet_string(b"dn=foo")));

        let elems = decode_all(&buf).expect("decode_all should succeed");
        assert_eq!(elems.len(), 3);
        assert_eq!(decode_integer(&elems[0]).unwrap(), 10);
        assert!(!decode_boolean(&elems[1]).unwrap());
        assert_eq!(decode_octet_string(&elems[2]).unwrap(), b"dn=foo");
    }

    // ── 12. Nested SEQUENCE (LDAP-like structure) ─────────────────────────────

    #[test]
    fn encode_decode_nested_sequence() {
        // Simulate: SEQUENCE { INTEGER(1), SEQUENCE { OCTET_STRING("uid"), OCTET_STRING("admin") } }
        let inner_seq = encode_sequence(vec![
            encode_octet_string(b"uid"),
            encode_octet_string(b"admin"),
        ]);
        let outer_seq = encode_sequence(vec![encode_integer(1), inner_seq]);
        let bytes = encode(&outer_seq);

        let (decoded, rest) = decode(&bytes).unwrap();
        assert_eq!(rest, b"");
        assert_eq!(decoded.tag, BerTag::Sequence);
        if let BerData::Constructed(children) = &decoded.data {
            assert_eq!(children.len(), 2);
            assert_eq!(decode_integer(&children[0]).unwrap(), 1);
            if let BerData::Constructed(inner_children) = &children[1].data {
                assert_eq!(decode_octet_string(&inner_children[0]).unwrap(), b"uid");
                assert_eq!(decode_octet_string(&inner_children[1]).unwrap(), b"admin");
            } else {
                panic!("expected inner Constructed");
            }
        } else {
            panic!("expected outer Constructed");
        }
    }

    // ── 13. Known BER wire bytes (manual verification) ────────────────────────

    #[test]
    fn known_wire_bytes() {
        // BOOLEAN true: 01 01 FF
        assert_eq!(encode(&encode_boolean(true)), [0x01, 0x01, 0xFF]);
        // BOOLEAN false: 01 01 00
        assert_eq!(encode(&encode_boolean(false)), [0x01, 0x01, 0x00]);
        // INTEGER 0: 02 01 00
        assert_eq!(encode(&encode_integer(0)), [0x02, 0x01, 0x00]);
        // INTEGER 128: 02 02 00 80
        assert_eq!(encode(&encode_integer(128)), [0x02, 0x02, 0x00, 0x80]);
        // OCTET STRING "hi": 04 02 68 69
        assert_eq!(
            encode(&encode_octet_string(b"hi")),
            [0x04, 0x02, b'h', b'i']
        );
        // ENUMERATED 0: 0A 01 00
        assert_eq!(encode(&encode_enumerated(0)), [0x0A, 0x01, 0x00]);
        // Empty SEQUENCE: 30 00
        assert_eq!(encode(&encode_sequence(vec![])), [0x30, 0x00]);
    }
}
