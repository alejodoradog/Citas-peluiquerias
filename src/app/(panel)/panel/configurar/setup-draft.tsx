"use client";

import {
  createContext,
  useContext,
  useEffect,
  useReducer,
  type Dispatch,
  type ReactNode,
} from "react";
import {
  initialDraft,
  setupReducer,
  type SetupAction,
  type SetupDraft,
} from "@/modulos/barberias/dominio/setup";

// The wizard draft lives in the browser until the owner finishes (task 2.1).
// The layout keeps it while the owner moves between steps; sessionStorage keeps
// it through a reload or a phone that drops the tab.
const STORAGE_KEY = "yapoin:asistente";

// ready: the stored draft, if any, is restored. Forms that start from it wait.
type DraftContext = {
  draft: SetupDraft;
  dispatch: Dispatch<SetupAction>;
  ready: boolean;
};

const Context = createContext<DraftContext | null>(null);

function readStored(): SetupDraft | null {
  try {
    const stored = window.sessionStorage.getItem(STORAGE_KEY);
    if (!stored) return null;
    const draft = JSON.parse(stored) as Partial<SetupDraft>;
    // A broken or older draft is dropped: the wizard starts over.
    const valid =
      Array.isArray(draft.services) &&
      Array.isArray(draft.barbers) &&
      typeof draft.ownerCuts === "boolean";
    return valid ? (draft as SetupDraft) : null;
  } catch {
    return null;
  }
}

export function clearStoredDraft() {
  try {
    window.sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // Storage can be blocked; the draft simply is not kept.
  }
}

type State = { draft: SetupDraft; ready: boolean };
type Action = SetupAction | { type: "restore"; draft: SetupDraft | null };

// "restore" runs once after mounting: it brings back the stored draft, if any,
// and marks the draft ready.
function reducer(state: State, action: Action): State {
  if (action.type === "restore") {
    return { draft: action.draft ?? state.draft, ready: true };
  }
  return { ...state, draft: setupReducer(state.draft, action) };
}

export function SetupDraftProvider({ children }: { children: ReactNode }) {
  const [state, dispatchAction] = useReducer(reducer, undefined, () => ({
    draft: initialDraft(),
    ready: false,
  }));
  const dispatch: Dispatch<SetupAction> = dispatchAction;

  // Restore after mounting, so the server and the first render match.
  useEffect(() => {
    dispatchAction({ type: "restore", draft: readStored() });
  }, []);

  useEffect(() => {
    if (!state.ready) return;
    try {
      window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state.draft));
    } catch {
      // Storage can be blocked; the draft lives only in memory then.
    }
  }, [state]);

  return (
    <Context value={{ draft: state.draft, dispatch, ready: state.ready }}>
      {children}
    </Context>
  );
}

export function useSetupDraft(): DraftContext {
  const context = useContext(Context);
  if (!context) throw new Error("useSetupDraft needs SetupDraftProvider");
  return context;
}
