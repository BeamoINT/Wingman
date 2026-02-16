-- Canonicalize messaging schema for participant_ids + membership-driven conversations.
-- This migration is idempotent and does not drop legacy participant_1/participant_2 columns.

BEGIN;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

ALTER TABLE IF EXISTS public.conversations
ADD COLUMN IF NOT EXISTS participant_ids UUID[] DEFAULT '{}'::UUID[];

ALTER TABLE IF EXISTS public.conversations
ADD COLUMN IF NOT EXISTS kind TEXT;

ALTER TABLE IF EXISTS public.conversations
ADD COLUMN IF NOT EXISTS title TEXT;

ALTER TABLE IF EXISTS public.conversations
ADD COLUMN IF NOT EXISTS avatar_url TEXT;

ALTER TABLE IF EXISTS public.conversations
ADD COLUMN IF NOT EXISTS group_id UUID REFERENCES public.friend_groups(id) ON DELETE SET NULL;

ALTER TABLE IF EXISTS public.conversations
ADD COLUMN IF NOT EXISTS event_id UUID REFERENCES public.friend_events(id) ON DELETE SET NULL;

ALTER TABLE IF EXISTS public.conversations
ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE IF EXISTS public.conversations
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

UPDATE public.conversations
SET kind = COALESCE(kind, 'direct'),
    updated_at = COALESCE(updated_at, last_message_at, created_at, NOW())
WHERE TRUE;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'conversations'
      AND column_name = 'participant_1'
  ) THEN
    IF EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'conversations'
        AND column_name = 'participant_2'
    ) THEN
      EXECUTE $q$
        UPDATE public.conversations
        SET participant_ids = ARRAY_REMOVE(ARRAY[participant_1, participant_2], NULL)
        WHERE COALESCE(ARRAY_LENGTH(participant_ids, 1), 0) = 0
      $q$;
    ELSE
      EXECUTE $q$
        UPDATE public.conversations
        SET participant_ids = ARRAY_REMOVE(ARRAY[participant_1], NULL)
        WHERE COALESCE(ARRAY_LENGTH(participant_ids, 1), 0) = 0
      $q$;
    END IF;
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS public.conversation_members (
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member',
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  left_at TIMESTAMPTZ,
  last_read_at TIMESTAMPTZ,
  mute_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT conversation_members_pkey PRIMARY KEY (conversation_id, user_id),
  CONSTRAINT conversation_members_role_check CHECK (role IN ('member', 'moderator', 'admin', 'host', 'system'))
);

CREATE INDEX IF NOT EXISTS idx_conversation_members_user_active
  ON public.conversation_members(user_id, conversation_id)
  WHERE left_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_conversation_members_conversation_active
  ON public.conversation_members(conversation_id, user_id)
  WHERE left_at IS NULL;

UPDATE public.conversations c
SET participant_ids = COALESCE(member_map.member_ids, '{}'::UUID[])
FROM (
  SELECT cm.conversation_id, ARRAY_AGG(DISTINCT cm.user_id ORDER BY cm.user_id) AS member_ids
  FROM public.conversation_members cm
  WHERE cm.left_at IS NULL
  GROUP BY cm.conversation_id
) member_map
WHERE c.id = member_map.conversation_id
  AND COALESCE(ARRAY_LENGTH(c.participant_ids, 1), 0) = 0;

UPDATE public.conversations
SET participant_ids = (
  SELECT COALESCE(ARRAY_AGG(DISTINCT id ORDER BY id), '{}'::UUID[])
  FROM UNNEST(COALESCE(participant_ids, '{}'::UUID[])) AS id
)
WHERE TRUE;

UPDATE public.conversations
SET participant_ids = '{}'::UUID[]
WHERE participant_ids IS NULL;

ALTER TABLE IF EXISTS public.conversations
ALTER COLUMN participant_ids SET DEFAULT '{}'::UUID[];

ALTER TABLE IF EXISTS public.conversations
ALTER COLUMN participant_ids SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_conversations_participant_ids
  ON public.conversations USING GIN (participant_ids);

CREATE INDEX IF NOT EXISTS idx_conversations_kind
  ON public.conversations(kind);

CREATE INDEX IF NOT EXISTS idx_conversations_updated_at
  ON public.conversations(updated_at DESC);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'conversations_kind_check_v2'
  ) THEN
    ALTER TABLE public.conversations
      ADD CONSTRAINT conversations_kind_check_v2
      CHECK (kind IN ('direct', 'group', 'event'));
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_conversations_updated_at'
  ) THEN
    CREATE TRIGGER trg_conversations_updated_at
    BEFORE UPDATE ON public.conversations
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_conversation_members_updated_at'
  ) THEN
    CREATE TRIGGER trg_conversation_members_updated_at
    BEFORE UPDATE ON public.conversation_members
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS public.message_device_identities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  device_id TEXT NOT NULL,
  public_key TEXT NOT NULL,
  key_version TEXT NOT NULL DEFAULT 'x25519-xsalsa20poly1305-v2',
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT message_device_identities_unique_device UNIQUE (user_id, device_id)
);

CREATE INDEX IF NOT EXISTS idx_message_device_identities_user_active
  ON public.message_device_identities(user_id, device_id)
  WHERE revoked_at IS NULL;

CREATE TABLE IF NOT EXISTS public.message_key_boxes (
  message_id UUID NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  recipient_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  recipient_device_id TEXT NOT NULL,
  wrapped_key TEXT NOT NULL,
  wrapped_key_nonce TEXT NOT NULL,
  sender_public_key TEXT NOT NULL,
  sender_key_version TEXT NOT NULL DEFAULT 'x25519-xsalsa20poly1305-v2',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT message_key_boxes_pkey PRIMARY KEY (message_id, recipient_user_id, recipient_device_id)
);

CREATE TABLE IF NOT EXISTS public.message_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  media_kind TEXT NOT NULL CHECK (media_kind IN ('image', 'video')),
  bucket TEXT NOT NULL,
  object_path TEXT NOT NULL,
  ciphertext_size_bytes INTEGER NOT NULL CHECK (ciphertext_size_bytes > 0),
  original_size_bytes INTEGER,
  duration_ms INTEGER,
  width INTEGER,
  height INTEGER,
  sha256 TEXT NOT NULL,
  thumbnail_object_path TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_message_attachments_message_id
  ON public.message_attachments(message_id);

CREATE INDEX IF NOT EXISTS idx_message_attachments_object
  ON public.message_attachments(bucket, object_path);

ALTER TABLE public.conversation_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_device_identities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_key_boxes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_attachments ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'conversation_members'
      AND policyname = 'Conversation members select canonical'
  ) THEN
    CREATE POLICY "Conversation members select canonical"
      ON public.conversation_members
      FOR SELECT
      USING (
        user_id = auth.uid()
        OR EXISTS (
          SELECT 1
          FROM public.conversation_members cm
          WHERE cm.conversation_id = conversation_members.conversation_id
            AND cm.user_id = auth.uid()
            AND cm.left_at IS NULL
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'conversation_members'
      AND policyname = 'Conversation members write canonical'
  ) THEN
    CREATE POLICY "Conversation members write canonical"
      ON public.conversation_members
      FOR ALL
      USING (user_id = auth.uid())
      WITH CHECK (user_id = auth.uid());
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'message_device_identities'
      AND policyname = 'Message device identities owner canonical'
  ) THEN
    CREATE POLICY "Message device identities owner canonical"
      ON public.message_device_identities
      FOR ALL
      USING (user_id = auth.uid())
      WITH CHECK (user_id = auth.uid());
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'message_key_boxes'
      AND policyname = 'Message key boxes member canonical'
  ) THEN
    CREATE POLICY "Message key boxes member canonical"
      ON public.message_key_boxes
      FOR SELECT
      USING (
        recipient_user_id = auth.uid()
        OR EXISTS (
          SELECT 1
          FROM public.messages m
          JOIN public.conversation_members cm
            ON cm.conversation_id = m.conversation_id
           AND cm.user_id = auth.uid()
           AND cm.left_at IS NULL
          WHERE m.id = message_key_boxes.message_id
        )
      );
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'message_attachments'
      AND policyname = 'Message attachments member canonical'
  ) THEN
    CREATE POLICY "Message attachments member canonical"
      ON public.message_attachments
      FOR SELECT
      USING (
        EXISTS (
          SELECT 1
          FROM public.conversation_members cm
          WHERE cm.conversation_id = message_attachments.conversation_id
            AND cm.user_id = auth.uid()
            AND cm.left_at IS NULL
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'message_attachments'
      AND policyname = 'Message attachments insert canonical'
  ) THEN
    CREATE POLICY "Message attachments insert canonical"
      ON public.message_attachments
      FOR INSERT
      WITH CHECK (
        sender_user_id = auth.uid()
        AND EXISTS (
          SELECT 1
          FROM public.conversation_members cm
          WHERE cm.conversation_id = message_attachments.conversation_id
            AND cm.user_id = auth.uid()
            AND cm.left_at IS NULL
        )
      );
  END IF;
END
$$;

CREATE OR REPLACE FUNCTION public.get_or_create_direct_conversation_v2(p_other_user_id UUID)
RETURNS public.conversations
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id UUID := auth.uid();
  canonical_pair UUID[];
  resolved_conversation public.conversations;
BEGIN
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_other_user_id IS NULL OR p_other_user_id = current_user_id THEN
    RAISE EXCEPTION 'Invalid conversation participant';
  END IF;

  canonical_pair := ARRAY(
    SELECT value
    FROM UNNEST(ARRAY[current_user_id, p_other_user_id]) AS value
    ORDER BY value
  );

  PERFORM pg_advisory_xact_lock(hashtext(canonical_pair::TEXT));

  SELECT c.*
  INTO resolved_conversation
  FROM public.conversations c
  WHERE c.kind = 'direct'
    AND c.participant_ids @> canonical_pair
    AND COALESCE(ARRAY_LENGTH(c.participant_ids, 1), 0) = 2
  ORDER BY c.created_at ASC
  LIMIT 1;

  IF NOT FOUND THEN
    INSERT INTO public.conversations (
      participant_ids,
      kind,
      created_by,
      created_at,
      updated_at
    ) VALUES (
      canonical_pair,
      'direct',
      current_user_id,
      NOW(),
      NOW()
    )
    RETURNING *
    INTO resolved_conversation;
  END IF;

  INSERT INTO public.conversation_members (
    conversation_id,
    user_id,
    role,
    joined_at,
    left_at
  )
  SELECT resolved_conversation.id, member_user_id, 'member', NOW(), NULL
  FROM UNNEST(canonical_pair) AS member_user_id
  ON CONFLICT (conversation_id, user_id)
  DO UPDATE SET
    left_at = NULL,
    updated_at = NOW();

  RETURN resolved_conversation;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_or_create_direct_conversation_v2(UUID) TO authenticated;

COMMIT;
