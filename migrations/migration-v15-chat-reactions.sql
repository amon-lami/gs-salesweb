-- Migration V15: Chat Reactions
-- Run this in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS chat_reactions (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    message_id uuid NOT NULL REFERENCES chat_messages(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES auth.users(id),
    emoji text NOT NULL,
    created_at timestamptz DEFAULT now(),
    UNIQUE(message_id, user_id, emoji)
);

-- Enable RLS
ALTER TABLE chat_reactions ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read all reactions
CREATE POLICY "Users can read all reactions" ON chat_reactions
    FOR SELECT TO authenticated USING (true);

-- Allow users to insert their own reactions
CREATE POLICY "Users can insert own reactions" ON chat_reactions
    FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- Allow users to delete their own reactions
CREATE POLICY "Users can delete own reactions" ON chat_reactions
    FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE chat_reactions;
