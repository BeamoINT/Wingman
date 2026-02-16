-- Secure media + group/event E2EE messaging v2
-- This migration keeps legacy direct-chat columns and APIs in place for backward reads.

BEGIN;

-- ---------------------------------------------------------
-- Foundational helpers
-- ---------------------------------------------------------

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.try_parse_uuid(value TEXT)
RETURNS UUID
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  RETURN value::UUID;
EXCEPTION WHEN OTHERS THEN
  RETURN NULL;
END;
$$;

-- ---------------------------------------------------------
-- Conversations: context-aware columns
-- ---------------------------------------------------------

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
SET
  kind = COALESCE(kind, CASE
    WHEN event_id IS NOT NULL THEN 'event'
    WHEN group_id IS NOT NULL THEN 'group'
    ELSE 'direct'
  END),
  created_by = COALESCE(created_by, participant_1, participant_2),
  updated_at = COALESCE(updated_at, last_message_at, created_at, NOW());

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'conversations_kind_check_v2'
  ) THEN
    ALTER TABLE public.conversations
      ADD CONSTRAINT conversations_kind_check_v2
      CHECK (kind IN ('direct', 'group', 'event'));
  END IF;
END
$$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_conversations_group_kind_unique
  ON public.conversations(group_id)
  WHERE group_id IS NOT NULL AND kind = 'group';

CREATE UNIQUE INDEX IF NOT EXISTS idx_conversations_event_kind_unique
  ON public.conversations(event_id)
  WHERE event_id IS NOT NULL AND kind = 'event';

CREATE INDEX IF NOT EXISTS idx_conversations_kind ON public.conversations(kind);
CREATE INDEX IF NOT EXISTS idx_conversations_updated_at ON public.conversations(updated_at DESC);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'trg_conversations_updated_at'
  ) THEN
    CREATE TRIGGER trg_conversations_updated_at
    BEFORE UPDATE ON public.conversations
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END
$$;

-- ---------------------------------------------------------
-- Membership model
-- ---------------------------------------------------------

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

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'trg_conversation_members_updated_at'
  ) THEN
    CREATE TRIGGER trg_conversation_members_updated_at
    BEFORE UPDATE ON public.conversation_members
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END
$$;

-- Backfill from direct participant columns.
INSERT INTO public.conversation_members (
  conversation_id,
  user_id,
  role,
  joined_at,
  left_at
)
SELECT
  c.id,
  c.participant_1,
  'member',
  COALESCE(c.created_at, NOW()),
  NULL
FROM public.conversations c
WHERE c.participant_1 IS NOT NULL
ON CONFLICT (conversation_id, user_id) DO NOTHING;

INSERT INTO public.conversation_members (
  conversation_id,
  user_id,
  role,
  joined_at,
  left_at
)
SELECT
  c.id,
  c.participant_2,
  'member',
  COALESCE(c.created_at, NOW()),
  NULL
FROM public.conversations c
WHERE c.participant_2 IS NOT NULL
ON CONFLICT (conversation_id, user_id) DO NOTHING;

-- Optional backfill from legacy conversation_participants table.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'conversation_participants'
  ) AND EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'conversation_participants'
      AND column_name = 'conversation_id'
  ) AND EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'conversation_participants'
      AND column_name = 'user_id'
  ) THEN
    INSERT INTO public.conversation_members (
      conversation_id,
      user_id,
      role,
      joined_at,
      left_at
    )
    SELECT
      cp.conversation_id,
      cp.user_id,
      'member',
      NOW(),
      NULL
    FROM public.conversation_participants cp
    WHERE cp.conversation_id IS NOT NULL
      AND cp.user_id IS NOT NULL
    ON CONFLICT (conversation_id, user_id)
    DO UPDATE SET
      left_at = NULL,
      joined_at = LEAST(public.conversation_members.joined_at, EXCLUDED.joined_at),
      updated_at = NOW();
  END IF;
END
$$;

-- ---------------------------------------------------------
-- Device identities (multi-device key model)
-- ---------------------------------------------------------

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

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'trg_message_device_identities_updated_at'
  ) THEN
    CREATE TRIGGER trg_message_device_identities_updated_at
    BEFORE UPDATE ON public.message_device_identities
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END
$$;

-- ---------------------------------------------------------
-- Messages v2 columns
-- ---------------------------------------------------------

ALTER TABLE IF EXISTS public.messages
ADD COLUMN IF NOT EXISTS sender_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE IF EXISTS public.messages
ADD COLUMN IF NOT EXISTS sender_device_id TEXT;

ALTER TABLE IF EXISTS public.messages
ADD COLUMN IF NOT EXISTS message_kind TEXT;

ALTER TABLE IF EXISTS public.messages
ADD COLUMN IF NOT EXISTS ciphertext TEXT;

ALTER TABLE IF EXISTS public.messages
ADD COLUMN IF NOT EXISTS ciphertext_nonce TEXT;

ALTER TABLE IF EXISTS public.messages
ADD COLUMN IF NOT EXISTS ciphertext_version TEXT DEFAULT 'x25519-xsalsa20poly1305-v2';

ALTER TABLE IF EXISTS public.messages
ADD COLUMN IF NOT EXISTS preview_ciphertext TEXT;

ALTER TABLE IF EXISTS public.messages
ADD COLUMN IF NOT EXISTS preview_nonce TEXT;

ALTER TABLE IF EXISTS public.messages
ADD COLUMN IF NOT EXISTS client_message_id TEXT;

ALTER TABLE IF EXISTS public.messages
ADD COLUMN IF NOT EXISTS reply_to_message_id UUID REFERENCES public.messages(id) ON DELETE SET NULL;

UPDATE public.messages
SET
  sender_user_id = COALESCE(sender_user_id, sender_id),
  message_kind = COALESCE(message_kind, CASE
    WHEN type = 'booking_request' THEN 'booking_request'
    WHEN type = 'system' THEN 'system'
    WHEN type = 'image' THEN 'image'
    ELSE 'text'
  END),
  ciphertext_version = COALESCE(ciphertext_version, 'x25519-xsalsa20poly1305-v2');

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'messages_message_kind_check_v2'
  ) THEN
    ALTER TABLE public.messages
      ADD CONSTRAINT messages_message_kind_check_v2
      CHECK (message_kind IN ('text', 'image', 'video', 'system', 'booking_request'));
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_messages_sender_user_id ON public.messages(sender_user_id);
CREATE INDEX IF NOT EXISTS idx_messages_conversation_created_at ON public.messages(conversation_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_message_kind ON public.messages(message_kind);

CREATE UNIQUE INDEX IF NOT EXISTS idx_messages_client_message_id_sender
  ON public.messages(sender_user_id, client_message_id)
  WHERE client_message_id IS NOT NULL;

-- ---------------------------------------------------------
-- Per-device key boxes
-- ---------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.message_key_boxes (
  message_id UUID NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  recipient_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  recipient_device_id TEXT NOT NULL,
  wrapped_key TEXT NOT NULL,
  wrapped_key_nonce TEXT NOT NULL,
  sender_public_key TEXT NOT NULL,
  sender_key_version TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT message_key_boxes_pkey PRIMARY KEY (message_id, recipient_user_id, recipient_device_id)
);

CREATE INDEX IF NOT EXISTS idx_message_key_boxes_recipient
  ON public.message_key_boxes(recipient_user_id, recipient_device_id);

-- ---------------------------------------------------------
-- Encrypted attachment registry
-- ---------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.message_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  media_kind TEXT NOT NULL CHECK (media_kind IN ('image', 'video')),
  bucket TEXT NOT NULL,
  object_path TEXT NOT NULL,
  ciphertext_size_bytes BIGINT NOT NULL,
  original_size_bytes BIGINT,
  duration_ms INTEGER,
  width INTEGER,
  height INTEGER,
  sha256 TEXT NOT NULL,
  thumbnail_object_path TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT message_attachments_bucket_object_unique UNIQUE (bucket, object_path)
);

CREATE INDEX IF NOT EXISTS idx_message_attachments_message_id
  ON public.message_attachments(message_id);

CREATE INDEX IF NOT EXISTS idx_message_attachments_conversation_created_at
  ON public.message_attachments(conversation_id, created_at DESC);

-- ---------------------------------------------------------
-- Encrypted safety reports (user opt-in evidence disclosure)
-- ---------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.encrypted_message_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  message_id UUID REFERENCES public.messages(id) ON DELETE SET NULL,
  conversation_id UUID REFERENCES public.conversations(id) ON DELETE SET NULL,
  reason TEXT NOT NULL,
  notes TEXT,
  disclosed_plaintext TEXT,
  disclosed_ciphertext TEXT,
  disclosed_attachment_paths JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_encrypted_message_reports_reporter_created
  ON public.encrypted_message_reports(reporter_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_encrypted_message_reports_message
  ON public.encrypted_message_reports(message_id);

-- ---------------------------------------------------------
-- Membership helpers
-- ---------------------------------------------------------

CREATE OR REPLACE FUNCTION public.is_conversation_member(
  p_conversation_id UUID,
  p_user_id UUID,
  p_require_active BOOLEAN DEFAULT TRUE
)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
AS $$
  SELECT
    EXISTS (
      SELECT 1
      FROM public.conversation_members cm
      WHERE cm.conversation_id = p_conversation_id
        AND cm.user_id = p_user_id
        AND (
          NOT p_require_active
          OR cm.left_at IS NULL
        )
    )
    OR EXISTS (
      SELECT 1
      FROM public.conversations c
      WHERE c.id = p_conversation_id
        AND (
          c.participant_1 = p_user_id
          OR c.participant_2 = p_user_id
        )
    );
$$;

-- ---------------------------------------------------------
-- Group/Event conversation provisioning + sync
-- ---------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_or_create_group_conversation_internal(
  p_group_id UUID,
  p_actor UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_conversation_id UUID;
  v_title TEXT;
  v_owner UUID;
BEGIN
  SELECT c.id
  INTO v_conversation_id
  FROM public.conversations c
  WHERE c.group_id = p_group_id
    AND c.kind = 'group'
  LIMIT 1;

  IF v_conversation_id IS NOT NULL THEN
    RETURN v_conversation_id;
  END IF;

  SELECT fg.name, fg.created_by
  INTO v_title, v_owner
  FROM public.friend_groups fg
  WHERE fg.id = p_group_id;

  IF v_title IS NULL THEN
    RAISE EXCEPTION 'Group % not found', p_group_id;
  END IF;

  INSERT INTO public.conversations (
    kind,
    title,
    group_id,
    created_by,
    created_at,
    updated_at
  )
  VALUES (
    'group',
    v_title,
    p_group_id,
    COALESCE(p_actor, v_owner),
    NOW(),
    NOW()
  )
  RETURNING id INTO v_conversation_id;

  IF v_owner IS NOT NULL THEN
    INSERT INTO public.conversation_members (
      conversation_id,
      user_id,
      role,
      joined_at,
      left_at
    )
    VALUES (
      v_conversation_id,
      v_owner,
      'admin',
      NOW(),
      NULL
    )
    ON CONFLICT (conversation_id, user_id)
    DO UPDATE SET
      role = EXCLUDED.role,
      left_at = NULL,
      updated_at = NOW();
  END IF;

  INSERT INTO public.conversation_members (
    conversation_id,
    user_id,
    role,
    joined_at,
    left_at
  )
  SELECT
    v_conversation_id,
    gm.user_id,
    CASE
      WHEN gm.role IN ('admin', 'moderator') THEN gm.role
      ELSE 'member'
    END,
    gm.joined_at,
    NULL
  FROM public.group_memberships gm
  WHERE gm.group_id = p_group_id
  ON CONFLICT (conversation_id, user_id)
  DO UPDATE SET
    role = EXCLUDED.role,
    left_at = NULL,
    updated_at = NOW();

  RETURN v_conversation_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_or_create_event_conversation_internal(
  p_event_id UUID,
  p_actor UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_conversation_id UUID;
  v_title TEXT;
  v_host UUID;
  v_group_id UUID;
BEGIN
  SELECT c.id
  INTO v_conversation_id
  FROM public.conversations c
  WHERE c.event_id = p_event_id
    AND c.kind = 'event'
  LIMIT 1;

  IF v_conversation_id IS NOT NULL THEN
    RETURN v_conversation_id;
  END IF;

  SELECT fe.title, fe.host_id, fe.group_id
  INTO v_title, v_host, v_group_id
  FROM public.friend_events fe
  WHERE fe.id = p_event_id;

  IF v_title IS NULL THEN
    RAISE EXCEPTION 'Event % not found', p_event_id;
  END IF;

  INSERT INTO public.conversations (
    kind,
    title,
    event_id,
    group_id,
    created_by,
    created_at,
    updated_at
  )
  VALUES (
    'event',
    v_title,
    p_event_id,
    v_group_id,
    COALESCE(p_actor, v_host),
    NOW(),
    NOW()
  )
  RETURNING id INTO v_conversation_id;

  IF v_host IS NOT NULL THEN
    INSERT INTO public.conversation_members (
      conversation_id,
      user_id,
      role,
      joined_at,
      left_at
    )
    VALUES (
      v_conversation_id,
      v_host,
      'host',
      NOW(),
      NULL
    )
    ON CONFLICT (conversation_id, user_id)
    DO UPDATE SET
      role = EXCLUDED.role,
      left_at = NULL,
      updated_at = NOW();
  END IF;

  INSERT INTO public.conversation_members (
    conversation_id,
    user_id,
    role,
    joined_at,
    left_at
  )
  SELECT
    v_conversation_id,
    er.user_id,
    'member',
    NOW(),
    NULL
  FROM public.event_rsvps er
  WHERE er.event_id = p_event_id
    AND er.status IN ('going', 'interested')
  ON CONFLICT (conversation_id, user_id)
  DO UPDATE SET
    role = EXCLUDED.role,
    left_at = NULL,
    updated_at = NOW();

  RETURN v_conversation_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_friend_groups_ensure_conversation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.get_or_create_group_conversation_internal(NEW.id, NEW.created_by);
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_group_memberships_sync_conversation_members()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_conversation_id UUID;
  v_user_id UUID;
  v_role TEXT;
  v_group_id UUID;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_group_id := OLD.group_id;
    v_user_id := OLD.user_id;
    v_role := OLD.role;
  ELSE
    v_group_id := NEW.group_id;
    v_user_id := NEW.user_id;
    v_role := NEW.role;
  END IF;

  v_conversation_id := public.get_or_create_group_conversation_internal(v_group_id, v_user_id);

  IF TG_OP = 'DELETE' THEN
    UPDATE public.conversation_members
    SET
      left_at = NOW(),
      updated_at = NOW()
    WHERE conversation_id = v_conversation_id
      AND user_id = v_user_id
      AND left_at IS NULL;
    RETURN OLD;
  END IF;

  INSERT INTO public.conversation_members (
    conversation_id,
    user_id,
    role,
    joined_at,
    left_at
  )
  VALUES (
    v_conversation_id,
    v_user_id,
    CASE
      WHEN v_role IN ('admin', 'moderator') THEN v_role
      ELSE 'member'
    END,
    COALESCE(NEW.joined_at, NOW()),
    NULL
  )
  ON CONFLICT (conversation_id, user_id)
  DO UPDATE SET
    role = EXCLUDED.role,
    left_at = NULL,
    joined_at = LEAST(public.conversation_members.joined_at, EXCLUDED.joined_at),
    updated_at = NOW();

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_friend_events_ensure_conversation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_conversation_id UUID;
BEGIN
  v_conversation_id := public.get_or_create_event_conversation_internal(NEW.id, NEW.host_id);

  UPDATE public.conversations
  SET
    title = NEW.title,
    group_id = NEW.group_id,
    updated_at = NOW()
  WHERE id = v_conversation_id;

  INSERT INTO public.conversation_members (
    conversation_id,
    user_id,
    role,
    joined_at,
    left_at
  )
  VALUES (
    v_conversation_id,
    NEW.host_id,
    'host',
    NOW(),
    NULL
  )
  ON CONFLICT (conversation_id, user_id)
  DO UPDATE SET
    role = EXCLUDED.role,
    left_at = NULL,
    updated_at = NOW();

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_event_rsvps_sync_conversation_members()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_conversation_id UUID;
  v_user_id UUID;
  v_event_id UUID;
  v_status TEXT;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_event_id := OLD.event_id;
    v_user_id := OLD.user_id;
    v_status := 'not_going';
  ELSE
    v_event_id := NEW.event_id;
    v_user_id := NEW.user_id;
    v_status := NEW.status;
  END IF;

  v_conversation_id := public.get_or_create_event_conversation_internal(v_event_id, v_user_id);

  IF v_status IN ('going', 'interested') THEN
    INSERT INTO public.conversation_members (
      conversation_id,
      user_id,
      role,
      joined_at,
      left_at
    )
    VALUES (
      v_conversation_id,
      v_user_id,
      'member',
      NOW(),
      NULL
    )
    ON CONFLICT (conversation_id, user_id)
    DO UPDATE SET
      role = EXCLUDED.role,
      left_at = NULL,
      updated_at = NOW();
  ELSE
    UPDATE public.conversation_members
    SET
      left_at = NOW(),
      updated_at = NOW()
    WHERE conversation_id = v_conversation_id
      AND user_id = v_user_id
      AND left_at IS NULL;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_friend_groups_ensure_conversation ON public.friend_groups;
CREATE TRIGGER trg_friend_groups_ensure_conversation
AFTER INSERT ON public.friend_groups
FOR EACH ROW
EXECUTE FUNCTION public.trg_friend_groups_ensure_conversation();

DROP TRIGGER IF EXISTS trg_group_memberships_sync_conversation_members ON public.group_memberships;
CREATE TRIGGER trg_group_memberships_sync_conversation_members
AFTER INSERT OR UPDATE OR DELETE ON public.group_memberships
FOR EACH ROW
EXECUTE FUNCTION public.trg_group_memberships_sync_conversation_members();

DROP TRIGGER IF EXISTS trg_friend_events_ensure_conversation ON public.friend_events;
CREATE TRIGGER trg_friend_events_ensure_conversation
AFTER INSERT OR UPDATE OF title, group_id, host_id ON public.friend_events
FOR EACH ROW
EXECUTE FUNCTION public.trg_friend_events_ensure_conversation();

DROP TRIGGER IF EXISTS trg_event_rsvps_sync_conversation_members ON public.event_rsvps;
CREATE TRIGGER trg_event_rsvps_sync_conversation_members
AFTER INSERT OR UPDATE OR DELETE ON public.event_rsvps
FOR EACH ROW
EXECUTE FUNCTION public.trg_event_rsvps_sync_conversation_members();

-- Backfill all existing groups/events into conversations and members.
DO $$
DECLARE
  r_group RECORD;
  r_event RECORD;
BEGIN
  FOR r_group IN
    SELECT id, created_by FROM public.friend_groups
  LOOP
    PERFORM public.get_or_create_group_conversation_internal(r_group.id, r_group.created_by);
  END LOOP;

  FOR r_event IN
    SELECT id, host_id FROM public.friend_events
  LOOP
    PERFORM public.get_or_create_event_conversation_internal(r_event.id, r_event.host_id);
  END LOOP;
END
$$;

-- ---------------------------------------------------------
-- RPC layer
-- ---------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_or_create_group_conversation(p_group_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.group_memberships gm
    WHERE gm.group_id = p_group_id
      AND gm.user_id = v_user_id
  ) AND NOT EXISTS (
    SELECT 1
    FROM public.friend_groups fg
    WHERE fg.id = p_group_id
      AND fg.created_by = v_user_id
  ) THEN
    RAISE EXCEPTION 'Not authorized to access this group conversation';
  END IF;

  RETURN public.get_or_create_group_conversation_internal(p_group_id, v_user_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.get_or_create_event_conversation(p_event_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.friend_events fe
    WHERE fe.id = p_event_id
      AND fe.host_id = v_user_id
  ) AND NOT EXISTS (
    SELECT 1
    FROM public.event_rsvps er
    WHERE er.event_id = p_event_id
      AND er.user_id = v_user_id
      AND er.status IN ('going', 'interested')
  ) THEN
    RAISE EXCEPTION 'Not authorized to access this event conversation';
  END IF;

  RETURN public.get_or_create_event_conversation_internal(p_event_id, v_user_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.mark_conversation_read_v2(
  p_conversation_id UUID,
  p_read_at TIMESTAMPTZ DEFAULT NOW()
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT public.is_conversation_member(p_conversation_id, v_user_id, TRUE) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  INSERT INTO public.conversation_members (
    conversation_id,
    user_id,
    role,
    joined_at,
    left_at,
    last_read_at
  )
  VALUES (
    p_conversation_id,
    v_user_id,
    'member',
    NOW(),
    NULL,
    COALESCE(p_read_at, NOW())
  )
  ON CONFLICT (conversation_id, user_id)
  DO UPDATE SET
    left_at = NULL,
    last_read_at = GREATEST(
      COALESCE(public.conversation_members.last_read_at, to_timestamp(0)),
      COALESCE(EXCLUDED.last_read_at, NOW())
    ),
    updated_at = NOW();

  RETURN TRUE;
END;
$$;

CREATE OR REPLACE FUNCTION public.send_secure_message_v2(
  p_conversation_id UUID,
  p_sender_device_id TEXT,
  p_message_kind TEXT,
  p_ciphertext TEXT,
  p_ciphertext_nonce TEXT,
  p_ciphertext_version TEXT,
  p_preview_ciphertext TEXT DEFAULT NULL,
  p_preview_nonce TEXT DEFAULT NULL,
  p_client_message_id TEXT DEFAULT NULL,
  p_reply_to_message_id UUID DEFAULT NULL,
  p_key_boxes JSONB DEFAULT '[]'::JSONB,
  p_attachments JSONB DEFAULT '[]'::JSONB
)
RETURNS TABLE (
  message_id UUID,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_message_id UUID;
  v_created_at TIMESTAMPTZ;
  v_recent_count INTEGER;
  v_attachment_count INTEGER;
  v_key_box JSONB;
  v_attachment JSONB;
  v_message_kind TEXT;
  v_legacy_type TEXT;
  v_recipient_user_id UUID;
  v_recipient_device_id TEXT;
  v_wrapped_key TEXT;
  v_wrapped_key_nonce TEXT;
  v_sender_public_key TEXT;
  v_sender_key_version TEXT;
  v_media_kind TEXT;
  v_bucket TEXT;
  v_object_path TEXT;
  v_ciphertext_size BIGINT;
  v_original_size BIGINT;
  v_duration_ms INTEGER;
  v_width INTEGER;
  v_height INTEGER;
  v_sha256 TEXT;
  v_thumbnail_path TEXT;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT public.is_conversation_member(p_conversation_id, v_user_id, TRUE) THEN
    RAISE EXCEPTION 'Not authorized to send to this conversation';
  END IF;

  v_message_kind := LOWER(COALESCE(p_message_kind, 'text'));
  IF v_message_kind NOT IN ('text', 'image', 'video', 'system', 'booking_request') THEN
    RAISE EXCEPTION 'Invalid message kind';
  END IF;

  IF COALESCE(TRIM(p_ciphertext), '') = '' OR COALESCE(TRIM(p_ciphertext_nonce), '') = '' THEN
    RAISE EXCEPTION 'Encrypted payload is required';
  END IF;

  IF COALESCE(TRIM(p_sender_device_id), '') = '' THEN
    RAISE EXCEPTION 'Sender device ID is required';
  END IF;

  SELECT COUNT(*)
  INTO v_recent_count
  FROM public.messages m
  WHERE m.conversation_id = p_conversation_id
    AND COALESCE(m.sender_user_id, m.sender_id) = v_user_id
    AND m.created_at >= NOW() - INTERVAL '30 seconds';

  IF v_recent_count >= 20 THEN
    RAISE EXCEPTION 'Rate limit exceeded. Please wait before sending more messages.';
  END IF;

  v_attachment_count := COALESCE(jsonb_array_length(COALESCE(p_attachments, '[]'::JSONB)), 0);
  IF v_attachment_count > 4 THEN
    RAISE EXCEPTION 'Too many attachments. Max 4 per message.';
  END IF;

  v_legacy_type := CASE
    WHEN v_message_kind = 'booking_request' THEN 'booking_request'
    WHEN v_message_kind = 'system' THEN 'system'
    WHEN v_message_kind = 'image' THEN 'image'
    WHEN v_message_kind = 'video' THEN 'image'
    ELSE 'text'
  END;

  INSERT INTO public.messages (
    conversation_id,
    sender_id,
    sender_user_id,
    sender_device_id,
    content,
    type,
    message_kind,
    ciphertext,
    ciphertext_nonce,
    ciphertext_version,
    preview_ciphertext,
    preview_nonce,
    client_message_id,
    reply_to_message_id,
    is_read,
    created_at
  )
  VALUES (
    p_conversation_id,
    v_user_id,
    v_user_id,
    p_sender_device_id,
    'Encrypted message',
    v_legacy_type,
    v_message_kind,
    p_ciphertext,
    p_ciphertext_nonce,
    COALESCE(NULLIF(p_ciphertext_version, ''), 'x25519-xsalsa20poly1305-v2'),
    NULLIF(p_preview_ciphertext, ''),
    NULLIF(p_preview_nonce, ''),
    NULLIF(p_client_message_id, ''),
    p_reply_to_message_id,
    FALSE,
    NOW()
  )
  RETURNING id, created_at INTO v_message_id, v_created_at;

  FOR v_key_box IN
    SELECT value
    FROM jsonb_array_elements(COALESCE(p_key_boxes, '[]'::JSONB))
  LOOP
    v_recipient_user_id := public.try_parse_uuid(v_key_box->>'recipient_user_id');
    v_recipient_device_id := COALESCE(v_key_box->>'recipient_device_id', '');
    v_wrapped_key := COALESCE(v_key_box->>'wrapped_key', '');
    v_wrapped_key_nonce := COALESCE(v_key_box->>'wrapped_key_nonce', '');
    v_sender_public_key := COALESCE(v_key_box->>'sender_public_key', '');
    v_sender_key_version := COALESCE(v_key_box->>'sender_key_version', '');

    IF v_recipient_user_id IS NULL OR v_recipient_device_id = '' THEN
      RAISE EXCEPTION 'Invalid key box recipient';
    END IF;

    IF NOT public.is_conversation_member(p_conversation_id, v_recipient_user_id, TRUE) THEN
      RAISE EXCEPTION 'Recipient is not an active conversation member';
    END IF;

    IF v_wrapped_key = '' OR v_wrapped_key_nonce = '' OR v_sender_public_key = '' OR v_sender_key_version = '' THEN
      RAISE EXCEPTION 'Invalid key box payload';
    END IF;

    INSERT INTO public.message_key_boxes (
      message_id,
      recipient_user_id,
      recipient_device_id,
      wrapped_key,
      wrapped_key_nonce,
      sender_public_key,
      sender_key_version
    )
    VALUES (
      v_message_id,
      v_recipient_user_id,
      v_recipient_device_id,
      v_wrapped_key,
      v_wrapped_key_nonce,
      v_sender_public_key,
      v_sender_key_version
    )
    ON CONFLICT (message_id, recipient_user_id, recipient_device_id)
    DO UPDATE SET
      wrapped_key = EXCLUDED.wrapped_key,
      wrapped_key_nonce = EXCLUDED.wrapped_key_nonce,
      sender_public_key = EXCLUDED.sender_public_key,
      sender_key_version = EXCLUDED.sender_key_version;
  END LOOP;

  FOR v_attachment IN
    SELECT value
    FROM jsonb_array_elements(COALESCE(p_attachments, '[]'::JSONB))
  LOOP
    v_media_kind := LOWER(COALESCE(v_attachment->>'media_kind', ''));
    v_bucket := COALESCE(v_attachment->>'bucket', '');
    v_object_path := COALESCE(v_attachment->>'object_path', '');
    v_ciphertext_size := COALESCE(NULLIF(v_attachment->>'ciphertext_size_bytes', '')::BIGINT, 0);
    v_original_size := NULLIF(v_attachment->>'original_size_bytes', '')::BIGINT;
    v_duration_ms := NULLIF(v_attachment->>'duration_ms', '')::INTEGER;
    v_width := NULLIF(v_attachment->>'width', '')::INTEGER;
    v_height := NULLIF(v_attachment->>'height', '')::INTEGER;
    v_sha256 := COALESCE(v_attachment->>'sha256', '');
    v_thumbnail_path := NULLIF(v_attachment->>'thumbnail_object_path', '');

    IF v_media_kind NOT IN ('image', 'video') THEN
      RAISE EXCEPTION 'Invalid attachment media kind';
    END IF;

    IF v_bucket = '' OR v_object_path = '' OR v_sha256 = '' OR v_ciphertext_size <= 0 THEN
      RAISE EXCEPTION 'Invalid attachment payload';
    END IF;

    IF v_ciphertext_size > 20971520 THEN
      RAISE EXCEPTION 'Attachment exceeds 20MB ciphertext limit';
    END IF;

    IF v_media_kind = 'video' AND v_duration_ms IS NOT NULL AND v_duration_ms > 60000 THEN
      RAISE EXCEPTION 'Video exceeds 60 second limit';
    END IF;

    INSERT INTO public.message_attachments (
      message_id,
      conversation_id,
      sender_user_id,
      media_kind,
      bucket,
      object_path,
      ciphertext_size_bytes,
      original_size_bytes,
      duration_ms,
      width,
      height,
      sha256,
      thumbnail_object_path
    )
    VALUES (
      v_message_id,
      p_conversation_id,
      v_user_id,
      v_media_kind,
      v_bucket,
      v_object_path,
      v_ciphertext_size,
      v_original_size,
      v_duration_ms,
      v_width,
      v_height,
      v_sha256,
      v_thumbnail_path
    );
  END LOOP;

  UPDATE public.conversations
  SET
    last_message_at = v_created_at,
    last_message_preview = 'Encrypted message',
    updated_at = NOW()
  WHERE id = p_conversation_id;

  message_id := v_message_id;
  created_at := v_created_at;
  RETURN NEXT;
END;
$$;

-- ---------------------------------------------------------
-- RLS and policies
-- ---------------------------------------------------------

ALTER TABLE public.conversation_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_device_identities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_key_boxes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.encrypted_message_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own conversations" ON public.conversations;
DROP POLICY IF EXISTS "Users can create conversations" ON public.conversations;

CREATE POLICY "Conversation select for members v2" ON public.conversations
  FOR SELECT
  USING (
    auth.uid() IS NOT NULL
    AND public.is_conversation_member(id, auth.uid(), TRUE)
  );

CREATE POLICY "Conversation insert for participants v2" ON public.conversations
  FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND (
      auth.uid() = participant_1
      OR auth.uid() = participant_2
      OR auth.uid() = created_by
    )
  );

CREATE POLICY "Conversation update for active members v2" ON public.conversations
  FOR UPDATE
  USING (
    auth.uid() IS NOT NULL
    AND public.is_conversation_member(id, auth.uid(), TRUE)
  );

DROP POLICY IF EXISTS "Users can view messages in their conversations" ON public.messages;
DROP POLICY IF EXISTS "Users can send messages to their conversations" ON public.messages;
DROP POLICY IF EXISTS "Users can update own messages" ON public.messages;

CREATE POLICY "Message select for members v2" ON public.messages
  FOR SELECT
  USING (
    auth.uid() IS NOT NULL
    AND public.is_conversation_member(conversation_id, auth.uid(), TRUE)
  );

CREATE POLICY "Message insert for active members v2" ON public.messages
  FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND auth.uid() = COALESCE(sender_user_id, sender_id)
    AND public.is_conversation_member(conversation_id, auth.uid(), TRUE)
  );

CREATE POLICY "Message update for sender v2" ON public.messages
  FOR UPDATE
  USING (
    auth.uid() IS NOT NULL
    AND auth.uid() = COALESCE(sender_user_id, sender_id)
  );

CREATE POLICY "Conversation members select for members v2" ON public.conversation_members
  FOR SELECT
  USING (
    auth.uid() IS NOT NULL
    AND public.is_conversation_member(conversation_id, auth.uid(), TRUE)
  );

CREATE POLICY "Conversation members insert self/admin v2" ON public.conversation_members
  FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND (
      auth.uid() = user_id
      OR EXISTS (
        SELECT 1
        FROM public.conversations c
        WHERE c.id = conversation_id
          AND c.created_by = auth.uid()
      )
    )
  );

CREATE POLICY "Conversation members update self/admin v2" ON public.conversation_members
  FOR UPDATE
  USING (
    auth.uid() IS NOT NULL
    AND (
      auth.uid() = user_id
      OR EXISTS (
        SELECT 1
        FROM public.conversations c
        WHERE c.id = conversation_id
          AND c.created_by = auth.uid()
      )
    )
  )
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND (
      auth.uid() = user_id
      OR EXISTS (
        SELECT 1
        FROM public.conversations c
        WHERE c.id = conversation_id
          AND c.created_by = auth.uid()
      )
    )
  );

CREATE POLICY "Conversation members delete self/admin v2" ON public.conversation_members
  FOR DELETE
  USING (
    auth.uid() IS NOT NULL
    AND (
      auth.uid() = user_id
      OR EXISTS (
        SELECT 1
        FROM public.conversations c
        WHERE c.id = conversation_id
          AND c.created_by = auth.uid()
      )
    )
  );

CREATE POLICY "Device identities select own v2" ON public.message_device_identities
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Device identities insert own v2" ON public.message_device_identities
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Device identities update own v2" ON public.message_device_identities
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Device identities delete own v2" ON public.message_device_identities
  FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "Key boxes select recipient or sender v2" ON public.message_key_boxes
  FOR SELECT
  USING (
    auth.uid() IS NOT NULL
    AND (
      recipient_user_id = auth.uid()
      OR EXISTS (
        SELECT 1
        FROM public.messages m
        WHERE m.id = message_id
          AND COALESCE(m.sender_user_id, m.sender_id) = auth.uid()
      )
    )
  );

CREATE POLICY "Key boxes insert sender only v2" ON public.message_key_boxes
  FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.messages m
      WHERE m.id = message_id
        AND COALESCE(m.sender_user_id, m.sender_id) = auth.uid()
    )
  );

CREATE POLICY "Attachment select for members v2" ON public.message_attachments
  FOR SELECT
  USING (
    auth.uid() IS NOT NULL
    AND public.is_conversation_member(conversation_id, auth.uid(), TRUE)
  );

CREATE POLICY "Attachment insert for sender members v2" ON public.message_attachments
  FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND auth.uid() = sender_user_id
    AND public.is_conversation_member(conversation_id, auth.uid(), TRUE)
  );

CREATE POLICY "Attachment update for sender v2" ON public.message_attachments
  FOR UPDATE
  USING (
    auth.uid() IS NOT NULL
    AND auth.uid() = sender_user_id
  );

CREATE POLICY "Attachment delete for sender v2" ON public.message_attachments
  FOR DELETE
  USING (
    auth.uid() IS NOT NULL
    AND auth.uid() = sender_user_id
  );

CREATE POLICY "Encrypted report select own v2" ON public.encrypted_message_reports
  FOR SELECT
  USING (
    auth.uid() IS NOT NULL
    AND reporter_user_id = auth.uid()
  );

CREATE POLICY "Encrypted report insert own v2" ON public.encrypted_message_reports
  FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND reporter_user_id = auth.uid()
  );

-- ---------------------------------------------------------
-- Storage bucket + policies
-- ---------------------------------------------------------

INSERT INTO storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
VALUES (
  'message-media-encrypted',
  'message-media-encrypted',
  FALSE,
  52428800,
  ARRAY[
    'application/octet-stream',
    'image/jpeg',
    'image/png',
    'image/webp',
    'video/mp4',
    'video/quicktime'
  ]
)
ON CONFLICT (id)
DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "Message media select by conversation membership" ON storage.objects;
DROP POLICY IF EXISTS "Message media insert by conversation membership" ON storage.objects;
DROP POLICY IF EXISTS "Message media update by sender" ON storage.objects;
DROP POLICY IF EXISTS "Message media delete by sender" ON storage.objects;

CREATE POLICY "Message media select by conversation membership" ON storage.objects
  FOR SELECT
  USING (
    bucket_id = 'message-media-encrypted'
    AND EXISTS (
      SELECT 1
      FROM public.message_attachments ma
      WHERE ma.bucket = bucket_id
        AND ma.object_path = name
        AND public.is_conversation_member(ma.conversation_id, auth.uid(), TRUE)
    )
  );

CREATE POLICY "Message media insert by conversation membership" ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'message-media-encrypted'
    AND public.is_conversation_member(
      public.try_parse_uuid(split_part(name, '/', 1)),
      auth.uid(),
      TRUE
    )
  );

CREATE POLICY "Message media update by sender" ON storage.objects
  FOR UPDATE
  USING (
    bucket_id = 'message-media-encrypted'
    AND EXISTS (
      SELECT 1
      FROM public.message_attachments ma
      WHERE ma.bucket = bucket_id
        AND ma.object_path = name
        AND ma.sender_user_id = auth.uid()
    )
  )
  WITH CHECK (
    bucket_id = 'message-media-encrypted'
    AND EXISTS (
      SELECT 1
      FROM public.message_attachments ma
      WHERE ma.bucket = bucket_id
        AND ma.object_path = name
        AND ma.sender_user_id = auth.uid()
    )
  );

CREATE POLICY "Message media delete by sender" ON storage.objects
  FOR DELETE
  USING (
    bucket_id = 'message-media-encrypted'
    AND EXISTS (
      SELECT 1
      FROM public.message_attachments ma
      WHERE ma.bucket = bucket_id
        AND ma.object_path = name
        AND ma.sender_user_id = auth.uid()
    )
  );

-- ---------------------------------------------------------
-- Grants for authenticated role
-- ---------------------------------------------------------

GRANT EXECUTE ON FUNCTION public.get_or_create_group_conversation(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_or_create_event_conversation(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_conversation_read_v2(UUID, TIMESTAMPTZ) TO authenticated;
GRANT EXECUTE ON FUNCTION public.send_secure_message_v2(
  UUID,
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  UUID,
  JSONB,
  JSONB
) TO authenticated;

COMMIT;
