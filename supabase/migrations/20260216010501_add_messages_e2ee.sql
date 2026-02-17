-- End-to-end encrypted messaging schema.
-- Adds per-user public keys and per-recipient ciphertext fields.

ALTER TABLE IF EXISTS profiles
ADD COLUMN IF NOT EXISTS message_encryption_public_key TEXT;
ALTER TABLE IF EXISTS profiles
ADD COLUMN IF NOT EXISTS message_encryption_key_version TEXT DEFAULT 'x25519-xsalsa20poly1305-v1';
ALTER TABLE IF EXISTS profiles
ADD COLUMN IF NOT EXISTS message_encryption_updated_at TIMESTAMPTZ;
ALTER TABLE IF EXISTS messages
ADD COLUMN IF NOT EXISTS encrypted_for_participant_1 TEXT;
ALTER TABLE IF EXISTS messages
ADD COLUMN IF NOT EXISTS encrypted_for_participant_2 TEXT;
ALTER TABLE IF EXISTS messages
ADD COLUMN IF NOT EXISTS encryption_nonce_p1 TEXT;
ALTER TABLE IF EXISTS messages
ADD COLUMN IF NOT EXISTS encryption_nonce_p2 TEXT;
ALTER TABLE IF EXISTS messages
ADD COLUMN IF NOT EXISTS encryption_sender_public_key TEXT;
ALTER TABLE IF EXISTS messages
ADD COLUMN IF NOT EXISTS encryption_version TEXT DEFAULT 'x25519-xsalsa20poly1305-v1';
CREATE INDEX IF NOT EXISTS idx_profiles_message_encryption_public_key
  ON profiles(message_encryption_public_key)
  WHERE message_encryption_public_key IS NOT NULL;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'messages_e2ee_payload_complete'
  ) THEN
    ALTER TABLE messages
      ADD CONSTRAINT messages_e2ee_payload_complete
      CHECK (
        (
          encrypted_for_participant_1 IS NULL
          AND encrypted_for_participant_2 IS NULL
          AND encryption_nonce_p1 IS NULL
          AND encryption_nonce_p2 IS NULL
          AND encryption_sender_public_key IS NULL
        )
        OR
        (
          encrypted_for_participant_1 IS NOT NULL
          AND encrypted_for_participant_2 IS NOT NULL
          AND encryption_nonce_p1 IS NOT NULL
          AND encryption_nonce_p2 IS NOT NULL
          AND encryption_sender_public_key IS NOT NULL
        )
      );
  END IF;
END
$$;
