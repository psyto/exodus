"use client";

import { FC, ReactNode, createContext, useContext, useMemo } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { AnchorProvider } from "@coral-xyz/anchor";
import { ExodusClient, ExodusProgramIds } from "@exodus/sdk";
import { PROGRAM_IDS } from "@/lib/constants";

interface ExodusContextValue {
  client: ExodusClient | null;
}

const ExodusContext = createContext<ExodusContextValue>({ client: null });

export const useExodusContext = () => useContext(ExodusContext);

interface Props {
  children: ReactNode;
}

export const ExodusProvider: FC<Props> = ({ children }) => {
  const { connection } = useConnection();
  const wallet = useWallet();

  const client = useMemo(() => {
    if (!wallet.publicKey || !wallet.signTransaction) return null;

    const provider = new AnchorProvider(
      connection,
      wallet as any,
      AnchorProvider.defaultOptions()
    );

    const programIds: ExodusProgramIds = {
      core: PROGRAM_IDS.EXODUS_CORE,
      tbillVault: PROGRAM_IDS.TBILL_VAULT,
    };

    return new ExodusClient(connection, provider, programIds);
  }, [connection, wallet]);

  return (
    <ExodusContext.Provider value={{ client }}>
      {children}
    </ExodusContext.Provider>
  );
};
