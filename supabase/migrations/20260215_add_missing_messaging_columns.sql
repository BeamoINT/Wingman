-- Backfill messaging schema for legacy production environments.
-- Safe to run multiple times.

ALTER TABLE IF EXISTS conversations
ADD COLUMN IF NOT EXISTS participant_1 UUID;

ALTER TABLE IF EXISTS conversations
ADD COLUMN IF NOT EXISTS participant_2 UUID;

ALTER TABLE IF EXISTS conversations
ADD COLUMN IF NOT EXISTS booking_id UUID;

ALTER TABLE IF EXISTS conversations
ADD COLUMN IF NOT EXISTS last_message_at TIMESTAMPTZ;

ALTER TABLE IF EXISTS conversations
ADD COLUMN IF NOT EXISTS last_message_preview TEXT;

ALTER TABLE IF EXISTS conversations
ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE IF EXISTS messages
ADD COLUMN IF NOT EXISTS conversation_id UUID;

ALTER TABLE IF EXISTS messages
ADD COLUMN IF NOT EXISTS sender_id UUID;

ALTER TABLE IF EXISTS messages
ADD COLUMN IF NOT EXISTS content TEXT;

ALTER TABLE IF EXISTS messages
ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'text';

ALTER TABLE IF EXISTS messages
ADD COLUMN IF NOT EXISTS is_read BOOLEAN DEFAULT FALSE;

ALTER TABLE IF EXISTS messages
ADD COLUMN IF NOT EXISTS read_at TIMESTAMPTZ;

ALTER TABLE IF EXISTS messages
ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

UPDATE conversations
SET
  created_at = COALESCE(created_at, NOW()),
  last_message_preview = NULLIF(TRIM(COALESCE(last_message_preview, '')), '');

UPDATE messages
SET
  type = COALESCE(NULLIF(TRIM(type), ''), 'text'),
  is_read = COALESCE(is_read, FALSE),
  created_at = COALESCE(created_at, NOW());

-- Backfill canonical columns from known legacy names when present.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'conversations' AND column_name = 'user_1'
  ) THEN
    EXECUTE 'UPDATE conversations SET participant_1 = COALESCE(participant_1, user_1) WHERE participant_1 IS NULL';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'conversations' AND column_name = 'user_2'
  ) THEN
    EXECUTE 'UPDATE conversations SET participant_2 = COALESCE(participant_2, user_2) WHERE participant_2 IS NULL';
  END IF;

  -- Some environments store participants in a join table instead of on conversations.
  -- Backfill participant_1/participant_2 from conversation_participants when available.
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'conversation_participants'
  )
  AND EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'conversation_participants' AND column_name = 'conversation_id'
  )
  AND EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'conversation_participants' AND column_name = 'user_id'
  ) THEN
    EXECUTE '
      WITH ranked_participants AS (
        SELECT
          conversation_id,
          user_id,
          ROW_NUMBER() OVER (PARTITION BY conversation_id ORDER BY user_id) AS rn
        FROM conversation_participants
        WHERE conversation_id IS NOT NULL AND user_id IS NOT NULL
      ),
      first_participant AS (
        SELECT conversation_id, user_id
        FROM ranked_participants
        WHERE rn = 1
      ),
      second_participant AS (
        SELECT conversation_id, user_id
        FROM ranked_participants
        WHERE rn = 2
      )
      UPDATE conversations c
      SET
        participant_1 = COALESCE(c.participant_1, fp.user_id),
        participant_2 = COALESCE(c.participant_2, sp.user_id)
      FROM first_participant fp
      LEFT JOIN second_participant sp
        ON sp.conversation_id = fp.conversation_id
      WHERE c.id = fp.conversation_id
        AND (c.participant_1 IS NULL OR c.participant_2 IS NULL)
    ';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'messages' AND column_name = 'thread_id'
  ) THEN
    EXECUTE 'UPDATE messages SET conversation_id = COALESCE(conversation_id, thread_id) WHERE conversation_id IS NULL';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'messages' AND column_name = 'author_id'
  ) THEN
    EXECUTE 'UPDATE messages SET sender_id = COALESCE(sender_id, author_id) WHERE sender_id IS NULL';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'messages' AND column_name = 'user_id'
  ) THEN
    EXECUTE 'UPDATE messages SET sender_id = COALESCE(sender_id, user_id) WHERE sender_id IS NULL';
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_conversations_participant_1 ON conversations(participant_1);
CREATE INDEX IF NOT EXISTS idx_conversations_participant_2 ON conversations(participant_2);
CREATE INDEX IF NOT EXISTS idx_conversations_last_message_at ON conversations(last_message_at);
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender_id ON messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_is_read ON messages(is_read);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at);

-- Add canonical FK names expected by app query hints when column types allow.
-- Using NOT VALID avoids failures on existing legacy rows.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'conversations' AND column_name = 'participant_1' AND udt_name = 'uuid'
  )
  AND NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'conversations_participant_1_fkey'
  ) THEN
    ALTER TABLE conversations
    ADD CONSTRAINT conversations_participant_1_fkey
    FOREIGN KEY (participant_1) REFERENCES profiles(id) ON DELETE CASCADE NOT VALID;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'conversations' AND column_name = 'participant_2' AND udt_name = 'uuid'
  )
  AND NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'conversations_participant_2_fkey'
  ) THEN
    ALTER TABLE conversations
    ADD CONSTRAINT conversations_participant_2_fkey
    FOREIGN KEY (participant_2) REFERENCES profiles(id) ON DELETE CASCADE NOT VALID;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'messages' AND column_name = 'conversation_id' AND udt_name = 'uuid'
  )
  AND NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'messages_conversation_id_fkey'
  ) THEN
    ALTER TABLE messages
    ADD CONSTRAINT messages_conversation_id_fkey
    FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE NOT VALID;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'messages' AND column_name = 'sender_id' AND udt_name = 'uuid'
  )
  AND NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'messages_sender_id_fkey'
  ) THEN
    ALTER TABLE messages
    ADD CONSTRAINT messages_sender_id_fkey
    FOREIGN KEY (sender_id) REFERENCES profiles(id) ON DELETE SET NULL NOT VALID;
  END IF;
END
$$;
