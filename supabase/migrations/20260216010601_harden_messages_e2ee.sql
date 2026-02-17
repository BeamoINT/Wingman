-- Harden encrypted messaging by enforcing redacted plaintext content
-- and making encrypted payload fields immutable after insert.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'messages_e2ee_content_redacted'
  ) THEN
    ALTER TABLE messages
      ADD CONSTRAINT messages_e2ee_content_redacted
      CHECK (
        encrypted_for_participant_1 IS NULL
        OR content = 'Encrypted message'
      );
  END IF;
END
$$;
CREATE OR REPLACE FUNCTION prevent_messages_e2ee_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  old_row JSONB := to_jsonb(OLD);
  new_row JSONB := to_jsonb(NEW);
BEGIN
  IF new_row->>'conversation_id' IS DISTINCT FROM old_row->>'conversation_id' THEN
    RAISE EXCEPTION 'message conversation_id is immutable';
  END IF;

  IF new_row->>'sender_id' IS DISTINCT FROM old_row->>'sender_id' THEN
    RAISE EXCEPTION 'message sender_id is immutable';
  END IF;

  IF new_row->>'created_at' IS DISTINCT FROM old_row->>'created_at' THEN
    RAISE EXCEPTION 'message created_at is immutable';
  END IF;

  IF new_row->>'type' IS DISTINCT FROM old_row->>'type' THEN
    RAISE EXCEPTION 'message type is immutable';
  END IF;

  IF new_row->>'encrypted_for_participant_1' IS DISTINCT FROM old_row->>'encrypted_for_participant_1' THEN
    RAISE EXCEPTION 'encrypted_for_participant_1 is immutable';
  END IF;

  IF new_row->>'encrypted_for_participant_2' IS DISTINCT FROM old_row->>'encrypted_for_participant_2' THEN
    RAISE EXCEPTION 'encrypted_for_participant_2 is immutable';
  END IF;

  IF new_row->>'encryption_nonce_p1' IS DISTINCT FROM old_row->>'encryption_nonce_p1' THEN
    RAISE EXCEPTION 'encryption_nonce_p1 is immutable';
  END IF;

  IF new_row->>'encryption_nonce_p2' IS DISTINCT FROM old_row->>'encryption_nonce_p2' THEN
    RAISE EXCEPTION 'encryption_nonce_p2 is immutable';
  END IF;

  IF new_row->>'encryption_sender_public_key' IS DISTINCT FROM old_row->>'encryption_sender_public_key' THEN
    RAISE EXCEPTION 'encryption_sender_public_key is immutable';
  END IF;

  IF new_row->>'encryption_version' IS DISTINCT FROM old_row->>'encryption_version' THEN
    RAISE EXCEPTION 'encryption_version is immutable';
  END IF;

  IF old_row->>'encrypted_for_participant_1' IS NOT NULL
    AND new_row->>'content' IS DISTINCT FROM old_row->>'content' THEN
    RAISE EXCEPTION 'content is immutable for encrypted messages';
  END IF;

  RETURN NEW;
END
$$;
DROP TRIGGER IF EXISTS trg_prevent_messages_e2ee_mutation ON messages;
CREATE TRIGGER trg_prevent_messages_e2ee_mutation
BEFORE UPDATE ON messages
FOR EACH ROW
EXECUTE FUNCTION prevent_messages_e2ee_mutation();
