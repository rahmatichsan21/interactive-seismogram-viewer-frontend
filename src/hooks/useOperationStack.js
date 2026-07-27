import { useCallback, useState } from "react";

function createOperationId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function patchOperations(
  operations,
  operationId,
  patch
) {
  let operationFound = false;

  const nextOperations = operations.map((operation) => {
    if (operation.id !== operationId) {
      return operation;
    }

    operationFound = true;

    return {
      ...operation,
      ...patch,
      params: {
        ...operation.params,
        ...patch.params,
      },
    };
  });

  return operationFound
    ? nextOperations
    : operations;
}

export default function useOperationStack() {
  const [history, setHistory] = useState([[]]);
  const [pointer, setPointer] = useState(0);

  const currentOperations = history[pointer] ?? [];

  // Membuat snapshot baru.
  // Dipakai untuk Add Trim, toggle Enabled,
  // dan perubahan pertama pada satu grup Date/Hour/Minute.
  const addOperation = useCallback(
    (operation) => {
      const newOperation = {
        id: createOperationId(),
        enabled: true,
        ...operation,
      };

      const nextOperations = [
        ...currentOperations,
        newOperation,
      ];

      const nextHistory = [
        ...history.slice(0, pointer + 1),
        nextOperations,
      ];

      setHistory(nextHistory);
      setPointer(nextHistory.length - 1);
    },
    [currentOperations, history, pointer]
  );

  const updateOperation = useCallback(
    (operationId, patch) => {
      const nextOperations = patchOperations(
        currentOperations,
        operationId,
        patch
      );

      if (nextOperations === currentOperations) {
        return;
      }

      const nextHistory = [
        ...history.slice(0, pointer + 1),
        nextOperations,
      ];

      setHistory(nextHistory);
      setPointer(nextHistory.length - 1);
    },
    [currentOperations, history, pointer]
  );

  // Mengganti snapshot terakhir tanpa membuat history baru.
  // Dipakai ketika pengguna lanjut memilih Hour atau Minute.
  const replaceOperation = useCallback(
    (operationId, patch) => {
      const nextOperations = patchOperations(
        currentOperations,
        operationId,
        patch
      );

      if (nextOperations === currentOperations) {
        return;
      }

      setHistory((currentHistory) =>
        currentHistory.map((snapshot, index) =>
          index === pointer
            ? nextOperations
            : snapshot
        )
      );
    },
    [currentOperations, pointer]
  );

  const undo = useCallback(() => {
    setPointer((currentPointer) =>
      Math.max(0, currentPointer - 1)
    );
  }, []);

  const redo = useCallback(() => {
    setPointer((currentPointer) =>
      Math.min(
        history.length - 1,
        currentPointer + 1
      )
    );
  }, [history.length]);

  const reset = useCallback(() => {
    setHistory([[]]);
    setPointer(0);
  }, []);

  const getActiveOperations = useCallback(() => {
    return currentOperations.filter(
      (operation) => operation.enabled
    );
  }, [currentOperations]);

  return {
    history,
    pointer,
    canUndo: pointer > 0,
    canRedo: pointer < history.length - 1,
    addOperation,
    updateOperation,
    replaceOperation,
    undo,
    redo,
    reset,
    getActiveOperations,
  };
}