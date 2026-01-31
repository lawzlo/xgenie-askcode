-- =====================================================
-- Migration: 021_add_error_column
-- Description: Add missing error column to project_jobs
-- =====================================================

ALTER TABLE public.project_jobs ADD COLUMN IF NOT EXISTS error TEXT;
