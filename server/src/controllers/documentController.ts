import type { Request, Response } from "express";
import type {
  CreateDocumentInput,
  RenameDocumentInput,
  UpdateDocumentContentInput,
} from "@shared/document";
import {
  createDocument,
  deleteDocument,
  getDocumentById,
  listDocuments,
  renameDocument,
  updateDocumentContent,
} from "../services/documentService.js";
import { startOrResumeSession } from "../services/sessionService.js";
import { getServiceErrorResponse } from "../services/errors.js";

const getDocumentId = (req: Request, res: Response) => {
  const id = req.params.id;
  if (typeof id !== "string" || id.trim() === "") {
    res.status(400).json({ error: "Invalid document id" });
    return null;
  }

  return id;
};

export const createDocumentByName = async (req: Request, res: Response) => {
  try {
    const body = req.body as Partial<CreateDocumentInput>;
    const document = await createDocument(req.userId, body);
    return res.status(201).json(document);
  } catch (error) {
    const { statusCode, message } = getServiceErrorResponse(error);
    console.error(error);
    return res.status(statusCode).json({ error: message });
  }
};

export const getDocuments = async (req: Request, res: Response) => {
  try {
    const documents = await listDocuments(req.userId);
    return res.json(documents);
  } catch (error) {
    const { statusCode, message } = getServiceErrorResponse(error);
    console.error(error);
    return res.status(statusCode).json({ error: message });
  }
};

export const getDocument = async (req: Request, res: Response) => {
  try {
    const id = getDocumentId(req, res);
    if (!id) {
      return;
    }

    const document = await getDocumentById(req.userId, id);
    return res.json(document);
  } catch (error) {
    const { statusCode, message } = getServiceErrorResponse(error);
    console.error(error);
    return res.status(statusCode).json({ error: message });
  }
};

export const openDocument = async (req: Request, res: Response) => {
  try {
    const id = getDocumentId(req, res);
    if (!id) {
      return;
    }

    const { sessionId, resumed } = await startOrResumeSession(req.userId, {
      documentId: id,
      keystrokes: [],
    });
    const document = await getDocumentById(req.userId, id);

    return res.json({ document, sessionId, resumed });
  } catch (error) {
    const { statusCode, message } = getServiceErrorResponse(error);
    console.error(error);
    return res.status(statusCode).json({ error: message });
  }
};

export const patchDocumentContent = async (req: Request, res: Response) => {
  try {
    const id = getDocumentId(req, res);
    if (!id) {
      return;
    }

    const body = req.body as Partial<UpdateDocumentContentInput>;
    const document = await updateDocumentContent(req.userId, id, body);
    return res.json(document);
  } catch (error) {
    const { statusCode, message } = getServiceErrorResponse(error);
    console.error(error);
    return res.status(statusCode).json({ error: message });
  }
};

export const patchDocumentName = async (req: Request, res: Response) => {
  try {
    const id = getDocumentId(req, res);
    if (!id) {
      return;
    }

    const body = req.body as Partial<RenameDocumentInput>;
    const document = await renameDocument(req.userId, id, body);
    return res.json(document);
  } catch (error) {
    const { statusCode, message } = getServiceErrorResponse(error);
    console.error(error);
    return res.status(statusCode).json({ error: message });
  }
};

export const removeDocument = async (req: Request, res: Response) => {
  try {
    const id = getDocumentId(req, res);
    if (!id) {
      return;
    }

    await deleteDocument(req.userId, id);
    return res.status(204).send();
  } catch (error) {
    const { statusCode, message } = getServiceErrorResponse(error);
    console.error(error);
    return res.status(statusCode).json({ error: message });
  }
};
