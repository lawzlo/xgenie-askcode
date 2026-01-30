-- Shared conversations table for public Q&A links
CREATE TABLE public.shared_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  share_token VARCHAR(32) NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Index for fast token lookup
CREATE INDEX idx_shared_conversations_token ON shared_conversations(share_token);

-- Index for cleanup of expired shares
CREATE INDEX idx_shared_conversations_expires ON shared_conversations(expires_at);

-- RLS policies
ALTER TABLE shared_conversations ENABLE ROW LEVEL SECURITY;

-- Users can create shares for conversations they own
CREATE POLICY "Users can create shares for own conversations"
  ON shared_conversations FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM conversations c
      WHERE c.id = conversation_id AND c.user_id = auth.uid()
    )
  );

-- Users can view their own shares
CREATE POLICY "Users can view own shares"
  ON shared_conversations FOR SELECT
  USING (created_by = auth.uid());

-- Users can delete their own shares
CREATE POLICY "Users can delete own shares"
  ON shared_conversations FOR DELETE
  USING (created_by = auth.uid());
