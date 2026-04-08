-- Migration 236: chat.channel_members table
-- The list_channels query filters by chat.channel_members but that table
-- did not exist in the chat schema.  Migration 028 created a similarly-named
-- table in the public schema referencing documents(id) which is wrong.

CREATE TABLE IF NOT EXISTS chat.channel_members (
    id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    channel_id UUID        NOT NULL REFERENCES chat.channels(id) ON DELETE CASCADE,
    user_id    UUID        NOT NULL,
    role       VARCHAR(20) NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
    joined_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (channel_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_chat_channel_members_channel ON chat.channel_members(channel_id);
CREATE INDEX IF NOT EXISTS idx_chat_channel_members_user    ON chat.channel_members(user_id);

-- Back-fill: make all existing channel creators members (owner role)
INSERT INTO chat.channel_members (channel_id, user_id, role)
SELECT id, created_by, 'owner'
FROM chat.channels
ON CONFLICT (channel_id, user_id) DO NOTHING;
