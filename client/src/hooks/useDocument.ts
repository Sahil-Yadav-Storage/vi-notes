import { useCallback, useEffect, useState } from "react";
import axios from "axios";
import type {
  CreateDocumentInput,
  DocumentDetail,
  DocumentSummary,
  OpenDocumentSessionResponse,
  RenameDocumentInput,
  UpdateDocumentContentInput,
} from "@shared/document";
import { api } from "../api";

type RenameErrors = Record<string, string | null>;

const getApiErrorMessage = (error: unknown, fallback: string) => {
  if (axios.isAxiosError(error)) {
    return (error.response?.data?.error as string | undefined) ?? fallback;
  }

  return fallback;
};

const isConflictError = (error: unknown) =>
  axios.isAxiosError(error) && error.response?.status === 409;

export const useDocument = (options?: { autoLoad?: boolean }) => {
  const autoLoad = options?.autoLoad ?? true;
  const [documents, setDocuments] = useState<DocumentSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);
  const [renameErrors, setRenameErrors] = useState<RenameErrors>({});

  const loadDocuments = useCallback(async () => {
    setIsLoading(true);

    try {
      const response = await api.get<DocumentSummary[]>("/api/documents");
      setDocuments(response.data);
      setError(null);
    } catch (fetchError) {
      setError(getApiErrorMessage(fetchError, "Failed to load files."));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!autoLoad) {
      setIsLoading(false);
      return;
    }

    void loadDocuments();
  }, [autoLoad, loadDocuments]);

  const createDocument = useCallback(async (name: string) => {
    try {
      const response = await api.post<
        DocumentDetail,
        { data: DocumentDetail },
        CreateDocumentInput
      >("/api/documents", { name });

      setCreateError(null);
      setDocuments((prev) => [response.data, ...prev]);
      return response.data;
    } catch (createDocError) {
      if (isConflictError(createDocError)) {
        setCreateError("A file with this name already exists.");
      } else {
        setCreateError(
          getApiErrorMessage(createDocError, "Failed to create file."),
        );
      }

      return null;
    }
  }, []);

  const renameDocument = useCallback(
    async (documentId: string, name: string) => {
      try {
        const response = await api.patch<
          DocumentDetail,
          { data: DocumentDetail },
          RenameDocumentInput
        >(`/api/documents/${documentId}/rename`, { name });

        setRenameErrors((prev) => ({ ...prev, [documentId]: null }));
        setDocuments((prev) =>
          prev.map((document) =>
            document._id === documentId
              ? {
                  ...document,
                  name: response.data.name,
                  updatedAt: response.data.updatedAt,
                }
              : document,
          ),
        );

        return response.data;
      } catch (renameDocError) {
        const message = isConflictError(renameDocError)
          ? "A file with this name already exists."
          : getApiErrorMessage(renameDocError, "Failed to rename file.");

        setRenameErrors((prev) => ({ ...prev, [documentId]: message }));
        return null;
      }
    },
    [],
  );

  const deleteDocument = useCallback(async (documentId: string) => {
    await api.delete(`/api/documents/${documentId}`);
    setDocuments((prev) =>
      prev.filter((document) => document._id !== documentId),
    );
  }, []);

  const getDocumentById = useCallback(async (documentId: string) => {
    const response = await api.get<DocumentDetail>(
      `/api/documents/${documentId}`,
    );
    return response.data;
  }, []);

  const updateDocumentContent = useCallback(
    async (documentId: string, content: string) => {
      const response = await api.patch<
        DocumentDetail,
        { data: DocumentDetail },
        UpdateDocumentContentInput
      >(`/api/documents/${documentId}/content`, { content });

      setDocuments((prev) =>
        prev.map((document) =>
          document._id === documentId
            ? { ...document, updatedAt: response.data.updatedAt }
            : document,
        ),
      );

      return response.data;
    },
    [],
  );

  const openDocument = useCallback(async (documentId: string) => {
    const response = await api.post<OpenDocumentSessionResponse>(
      `/api/documents/${documentId}/open`,
    );

    return response.data;
  }, []);

  const clearCreateError = useCallback(() => setCreateError(null), []);
  const clearRenameError = useCallback((documentId: string) => {
    setRenameErrors((prev) => ({ ...prev, [documentId]: null }));
  }, []);

  return {
    documents,
    isLoading,
    error,
    createError,
    renameErrors,
    loadDocuments,
    createDocument,
    renameDocument,
    deleteDocument,
    getDocumentById,
    updateDocumentContent,
    openDocument,
    clearCreateError,
    clearRenameError,
  };
};
