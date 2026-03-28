import type { Keystroke } from "@shared/keystroke";

const DB_NAME = "vi_notes_sync";
const DB_VERSION = 2;
const STORE_NAME = "keystroke_queue";

let openDbPromise: Promise<IDBDatabase> | null = null;

export type QueuedKeystroke = {
  id: number;
  documentId: string;
  event: Keystroke;
};

type StoredKeystrokeRecord = {
  documentId: string;
  event: Keystroke;
};

// This durable queue is intentionally separate from the in-memory SessionContext buffer.
// IndexedDB protects against refresh/crash/offline restarts, while memory keeps a small
// active working set for sync operations. Their caps are independent safeguards.
const openDb = () => {
  if (openDbPromise) {
    return openDbPromise;
  }

  openDbPromise = new Promise((resolve, reject) => {
    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (db.objectStoreNames.contains(STORE_NAME)) {
        return;
      }

      // Auto-increment provides a monotonic sequence key for strict FIFO retrieval.
      db.createObjectStore(STORE_NAME, { autoIncrement: true });
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onerror = () => {
      reject(
        request.error ?? new Error("Failed to open keystroke queue database."),
      );
    };
  });

  return openDbPromise;
};

const withStore = async <T>(
  mode: IDBTransactionMode,
  executor: (
    store: IDBObjectStore,
    transaction: IDBTransaction,
  ) => Promise<T> | T,
) => {
  const db = await openDb();

  return new Promise<T>((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, mode);
    const store = transaction.objectStore(STORE_NAME);

    let completed = false;
    let result: T;
    let hasResult = false;

    transaction.oncomplete = () => {
      if (!completed && hasResult) {
        completed = true;
        resolve(result);
      }
    };

    Promise.resolve(executor(store, transaction))
      .then((value) => {
        result = value;
        hasResult = true;
      })
      .catch((error) => {
        if (!completed) {
          completed = true;
          reject(error);
        }
      });

    transaction.onerror = () => {
      if (!completed) {
        completed = true;
        reject(transaction.error ?? new Error("IndexedDB transaction failed."));
      }
    };

    transaction.onabort = () => {
      if (!completed) {
        completed = true;
        reject(
          transaction.error ?? new Error("IndexedDB transaction aborted."),
        );
      }
    };
  });
};

const requestToPromise = <T>(request: IDBRequest<T>) =>
  new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error ?? new Error("IndexedDB request failed."));
  });

const readOldestKeys = async (limit: number) => {
  return withStore("readonly", async (store) => {
    const keys: number[] = [];
    const request = store.openCursor();

    await new Promise<void>((resolve, reject) => {
      request.onsuccess = () => {
        const cursor = request.result;

        if (!cursor || keys.length >= limit) {
          resolve();
          return;
        }

        keys.push(cursor.key as number);
        cursor.continue();
      };

      request.onerror = () => {
        reject(request.error ?? new Error("Failed reading queue keys."));
      };
    });

    return keys;
  });
};

const count = async () =>
  withStore("readonly", async (store) => {
    const request = store.count();
    return requestToPromise(request);
  });

const trimToCap = async (maxEvents: number) => {
  if (maxEvents <= 0) {
    await withStore("readwrite", async (store) => {
      store.clear();
    });
    return 0;
  }

  const total = await count();
  if (total <= maxEvents) {
    return 0;
  }

  const toDelete = total - maxEvents;
  const oldestKeys = await readOldestKeys(toDelete);

  await withStore("readwrite", async (store) => {
    for (const key of oldestKeys) {
      store.delete(key);
    }
  });

  return oldestKeys.length;
};

const enqueue = async (
  documentId: string,
  events: Keystroke[],
  maxEvents: number,
) => {
  if (!documentId) {
    throw new Error("documentId is required to enqueue keystrokes.");
  }

  if (events.length === 0) {
    return 0;
  }

  await withStore("readwrite", async (store) => {
    for (const event of events) {
      store.add({ documentId, event } satisfies StoredKeystrokeRecord);
    }
  });

  return trimToCap(maxEvents);
};

const peek = async (limit: number) => {
  if (limit <= 0) {
    return [] as QueuedKeystroke[];
  }

  return withStore("readonly", async (store) => {
    const results: QueuedKeystroke[] = [];
    const request = store.openCursor();

    await new Promise<void>((resolve, reject) => {
      request.onsuccess = () => {
        const cursor = request.result;

        if (!cursor || results.length >= limit) {
          resolve();
          return;
        }

        results.push({
          id: cursor.key as number,
          documentId:
            typeof (cursor.value as StoredKeystrokeRecord)?.documentId ===
            "string"
              ? (cursor.value as StoredKeystrokeRecord).documentId
              : "",
          event:
            (cursor.value as StoredKeystrokeRecord)?.event ??
            (cursor.value as Keystroke),
        });
        cursor.continue();
      };

      request.onerror = () => {
        reject(request.error ?? new Error("Failed reading queued keystrokes."));
      };
    });

    return results;
  });
};

const peekByDocument = async (documentId: string, limit: number) => {
  if (!documentId || limit <= 0) {
    return [] as QueuedKeystroke[];
  }

  return withStore("readonly", async (store) => {
    const results: QueuedKeystroke[] = [];
    const request = store.openCursor();

    await new Promise<void>((resolve, reject) => {
      request.onsuccess = () => {
        const cursor = request.result;

        if (!cursor || results.length >= limit) {
          resolve();
          return;
        }

        const value = cursor.value as StoredKeystrokeRecord | Keystroke;
        const queuedDocumentId =
          typeof (value as StoredKeystrokeRecord)?.documentId === "string"
            ? (value as StoredKeystrokeRecord).documentId
            : "";

        if (queuedDocumentId === documentId) {
          results.push({
            id: cursor.key as number,
            documentId: queuedDocumentId,
            event:
              (value as StoredKeystrokeRecord).event ?? (value as Keystroke),
          });
        }

        cursor.continue();
      };

      request.onerror = () => {
        reject(request.error ?? new Error("Failed reading queued keystrokes."));
      };
    });

    return results;
  });
};

const ackThrough = async (maxInclusiveKey: number) => {
  await withStore("readwrite", async (store) => {
    const range = IDBKeyRange.upperBound(maxInclusiveKey);
    store.delete(range);
  });
};

const ackKeys = async (keys: number[]) => {
  if (keys.length === 0) {
    return;
  }

  await withStore("readwrite", async (store) => {
    for (const key of keys) {
      store.delete(key);
    }
  });
};

const clear = async () => {
  await withStore("readwrite", async (store) => {
    store.clear();
  });
};

export const keystrokeQueue = {
  enqueue,
  peek,
  peekByDocument,
  ackThrough,
  ackKeys,
  count,
  clear,
};
