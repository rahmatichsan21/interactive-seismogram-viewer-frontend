  import { useCallback, useState, useEffect } from "react";

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

    // Pipeline yang sedang diedit user.
    const [pipeline, setPipeline] = useState([]);

    useEffect(() => {
        console.log("Pointer:", pointer);
        console.log("Pipeline:", pipeline);
        console.log("History:", history);
    }, [pipeline, history, pointer]);

  // Membuat snapshot baru.
  // Dipakai untuk Add Trim, toggle Enabled,
  // dan perubahan pertama pada satu grup Date/Hour/Minute.
    const addOperation = useCallback((operation) => {
        const newOperation = {
            id: createOperationId(),
            enabled: true,
            ...operation,
        };

        // Edit pipeline saja.
        setPipeline((currentPipeline) => [
            ...currentPipeline,
            newOperation,
        ]);
    }, []);

    const updateOperation = useCallback(
        (operationId, patch) => {
            setPipeline((currentPipeline) =>
            patchOperations(
                currentPipeline,
                operationId,
                patch
            )
            );
        },
        []
    );

    const commit = useCallback(() => {
        const snapshot = pipeline.map((operation) => ({
            ...operation,
            params: {
                ...operation.params,
            },
        }));

        const nextHistory = [
            ...history.slice(0, pointer + 1),
            snapshot,
        ];

        setHistory(nextHistory);
        setPointer(nextHistory.length - 1);
    }, [history, pointer, pipeline]);
    
    const undo = useCallback(() => {
        if (pointer <= 0) {
            return null;
        }

        const nextPointer = pointer - 1;
        const nextPipeline =
            history[nextPointer] ?? [];

        setPointer(nextPointer);
        setPipeline(nextPipeline);

        return nextPipeline;
    }, [pointer, history]);

    const redo = useCallback(() => {
        if (pointer >= history.length - 1) {
            return null;
        }

        const nextPointer = pointer + 1;
        const nextPipeline =
            history[nextPointer] ?? [];

        setPointer(nextPointer);
        setPipeline(nextPipeline);

        return nextPipeline;
    }, [pointer, history]);

  const reset = useCallback(() => {
        setHistory([[]]);
        setPointer(0);

        // Kembali ke pipeline kosong.
        setPipeline([]);
    }, []);

    const getActiveOperations = useCallback(() => {
        return pipeline.filter(
            (operation) => operation.enabled
        );
    }, [pipeline]);

    return {
        history,
        pointer,
        pipeline,

        canUndo: pointer > 0,
        canRedo: pointer < history.length - 1,

        addOperation,
        updateOperation,
        commit,

        undo,
        redo,
        reset,

        getActiveOperations,
    };
}