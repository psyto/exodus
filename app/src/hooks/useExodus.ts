"use client";

import { useExodusContext } from "@/providers/ExodusProvider";

/**
 * Hook to access the ExodusClient from context.
 */
export function useExodus() {
  const { client } = useExodusContext();
  return { client };
}
