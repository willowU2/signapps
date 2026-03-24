CREATE OR REPLACE FUNCTION gen_uuid_v7() RETURNS UUID AS $$
DECLARE
    unix_ts_ms BIGINT;
    uuid_bytes BYTEA;
BEGIN
    unix_ts_ms = (EXTRACT(EPOCH FROM clock_timestamp()) * 1000)::BIGINT;
    uuid_bytes = SET_BYTE(
        SET_BYTE(
            overlay(uuid_send(gen_random_uuid()) placing substring(int8send(unix_ts_ms) from 3) from 1 for 6),
        6, (GET_BYTE(uuid_send(gen_random_uuid()), 6) & 15) | 112),
    8, (GET_BYTE(uuid_send(gen_random_uuid()), 8) & 63) | 128);
    RETURN encode(uuid_bytes, 'hex')::UUID;
END;
$$ LANGUAGE plpgsql VOLATILE;
