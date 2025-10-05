/**
 * Lintnotes
 * - Purpose: Convenience hook that re-exports the Supabase context consumer.
 * - Exports: useSupabase
 * - Major deps: contexts/SupabaseContext
 * - Side effects: None.
 */
import { useSupabaseContext } from '../contexts/SupabaseContext';

export const useSupabase = () => useSupabaseContext();
