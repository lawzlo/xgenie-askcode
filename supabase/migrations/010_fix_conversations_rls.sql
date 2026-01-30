-- Fix: Users should only see their own conversations, not teammates'

DROP POLICY IF EXISTS "Users can manage conversations" ON public.conversations;

CREATE POLICY "Users can manage own conversations" ON public.conversations
FOR ALL USING (user_id = auth.uid());
