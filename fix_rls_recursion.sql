-- Fix infinite recursion in organization_members RLS policy
-- The issue: org_members_select_self policy references my_orgs view,
-- but my_orgs view references organization_members table, creating circular dependency

-- Drop the problematic policy
DROP POLICY IF EXISTS "org_members_select_self" ON public.organization_members;

-- Recreate the policy without the circular reference
-- Users can see their own memberships directly, no need to reference my_orgs
CREATE POLICY "org_members_select_self"
  ON public.organization_members FOR SELECT
  USING (user_id = auth.uid());

-- Also fix the org_members_manage_by_admins policy to avoid the same issue
DROP POLICY IF EXISTS "org_members_manage_by_admins" ON public.organization_members;

-- Recreate with direct check instead of referencing my_orgs
CREATE POLICY "org_members_manage_by_admins"
  ON public.organization_members FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members m
      WHERE m.org_id = organization_members.org_id
        AND m.user_id = auth.uid()
        AND m.role IN ('owner','admin')
    )
  )
  WITH CHECK (true);
