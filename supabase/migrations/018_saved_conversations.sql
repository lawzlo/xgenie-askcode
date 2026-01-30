-- Saved conversations: let logged-in users bookmark shared Q&A
CREATE TABLE public.saved_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  source_share_token VARCHAR(32),  -- which share link it came from (optional, for tracking)
  saved_at TIMESTAMPTZ DEFAULT now(),

  -- Prevent duplicate saves
  UNIQUE(user_id, conversation_id)
);

-- Index for listing user's saved conversations
CREATE INDEX idx_saved_conversations_user ON saved_conversations(user_id, saved_at DESC);

-- RLS policies
ALTER TABLE saved_conversations ENABLE ROW LEVEL SECURITY;

-- Users can save conversations (from share links)
CREATE POLICY "Users can save conversations"
  ON saved_conversations FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can view their own saved conversations
CREATE POLICY "Users can view own saved conversations"
  ON saved_conversations FOR SELECT
  USING (auth.uid() = user_id);

-- Users can delete their own saved conversations
CREATE POLICY "Users can delete own saved conversations"
  ON saved_conversations FOR DELETE
  USING (auth.uid() = user_id);
