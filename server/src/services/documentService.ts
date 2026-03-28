import { Types } from "mongoose";
import type {
  CreateDocumentInput,
  DocumentDetail,
  DocumentSummary,
  RenameDocumentInput,
  UpdateDocumentContentInput,
} from "@shared/document";
import Document from "../models/Document.js";
import Session from "../models/Session.js";
import {
  ConflictError,
  NotFoundError,
  UnauthorizedError,
  ValidationError,
} from "./errors.js";

const toDocumentSummary = (document: {
  _id: Types.ObjectId;
  name: string;
  createdAt: Date;
  updatedAt: Date;
}): DocumentSummary => ({
  _id: document._id.toString(),
  name: document.name,
  createdAt: document.createdAt.toISOString(),
  updatedAt: document.updatedAt.toISOString(),
});

const toDocumentDetail = (document: {
  _id: Types.ObjectId;
  name: string;
  content: string;
  createdAt: Date;
  updatedAt: Date;
  lastOpenedSessionId?: Types.ObjectId;
}): DocumentDetail => ({
  ...toDocumentSummary(document),
  content: document.content,
  ...(document.lastOpenedSessionId && {
    lastOpenedSessionId: document.lastOpenedSessionId.toString(),
  }),
});

const assertUserId = (userId?: string): string => {
  if (!userId) {
    throw new UnauthorizedError("Unauthorized");
  }

  return userId;
};

const assertValidDocumentName = (name: unknown): string => {
  if (typeof name !== "string") {
    throw new ValidationError("name must be a string");
  }

  const normalized = name.trim();
  if (!normalized) {
    throw new ValidationError("name is required");
  }

  if (normalized.length > 120) {
    throw new ValidationError("name must be at most 120 characters");
  }

  return normalized;
};

const assertValidDocumentId = (documentId: string) => {
  if (!Types.ObjectId.isValid(documentId)) {
    throw new ValidationError("Invalid document id");
  }
};

const handleDuplicateKey = (error: unknown): never => {
  const maybeMongoError = error as { code?: number };
  if (maybeMongoError?.code === 11000) {
    throw new ConflictError("A file with this name already exists");
  }

  throw error;
};

export const createDocument = async (
  userId: string | undefined,
  input: Partial<CreateDocumentInput>,
): Promise<DocumentDetail> => {
  const ownerId = assertUserId(userId);
  const name = assertValidDocumentName(input.name);

  try {
    const created = await Document.create({
      user: new Types.ObjectId(ownerId),
      name,
      content: "",
    });

    return toDocumentDetail(created as never);
  } catch (error) {
    handleDuplicateKey(error);
    throw error;
  }
};

export const listDocuments = async (
  userId: string | undefined,
): Promise<DocumentSummary[]> => {
  const ownerId = assertUserId(userId);

  const documents = await Document.find({ user: new Types.ObjectId(ownerId) })
    .sort({ updatedAt: -1 })
    .select("name createdAt updatedAt")
    .lean();

  return documents.map((document) =>
    toDocumentSummary({
      _id: document._id,
      name: document.name,
      createdAt: document.createdAt,
      updatedAt: document.updatedAt,
    }),
  );
};

export const getDocumentById = async (
  userId: string | undefined,
  documentId: string,
): Promise<DocumentDetail> => {
  const ownerId = assertUserId(userId);
  assertValidDocumentId(documentId);

  const document = await Document.findOne({
    _id: new Types.ObjectId(documentId),
    user: new Types.ObjectId(ownerId),
  }).lean();

  if (!document) {
    throw new NotFoundError("File not found");
  }

  return toDocumentDetail({
    _id: document._id,
    name: document.name,
    content: document.content,
    createdAt: document.createdAt,
    updatedAt: document.updatedAt,
    ...(document.lastOpenedSessionId && {
      lastOpenedSessionId: document.lastOpenedSessionId,
    }),
  });
};

export const updateDocumentContent = async (
  userId: string | undefined,
  documentId: string,
  input: Partial<UpdateDocumentContentInput>,
): Promise<DocumentDetail> => {
  const ownerId = assertUserId(userId);
  assertValidDocumentId(documentId);

  if (typeof input.content !== "string") {
    throw new ValidationError("content must be a string");
  }

  const document = await Document.findOneAndUpdate(
    {
      _id: new Types.ObjectId(documentId),
      user: new Types.ObjectId(ownerId),
    },
    { $set: { content: input.content } },
    { returnDocument: "after" },
  ).lean();

  if (!document) {
    throw new NotFoundError("File not found");
  }

  return toDocumentDetail({
    _id: document._id,
    name: document.name,
    content: document.content,
    createdAt: document.createdAt,
    updatedAt: document.updatedAt,
    ...(document.lastOpenedSessionId && {
      lastOpenedSessionId: document.lastOpenedSessionId,
    }),
  });
};

export const renameDocument = async (
  userId: string | undefined,
  documentId: string,
  input: Partial<RenameDocumentInput>,
): Promise<DocumentDetail> => {
  const ownerId = assertUserId(userId);
  assertValidDocumentId(documentId);
  const name = assertValidDocumentName(input.name);

  try {
    const document = await Document.findOneAndUpdate(
      {
        _id: new Types.ObjectId(documentId),
        user: new Types.ObjectId(ownerId),
      },
      { $set: { name } },
      { returnDocument: "after" },
    ).lean();

    if (!document) {
      throw new NotFoundError("File not found");
    }

    return toDocumentDetail({
      _id: document._id,
      name: document.name,
      content: document.content,
      createdAt: document.createdAt,
      updatedAt: document.updatedAt,
      ...(document.lastOpenedSessionId && {
        lastOpenedSessionId: document.lastOpenedSessionId,
      }),
    });
  } catch (error) {
    handleDuplicateKey(error);
    throw error;
  }
};

export const deleteDocument = async (
  userId: string | undefined,
  documentId: string,
): Promise<void> => {
  const ownerId = assertUserId(userId);
  assertValidDocumentId(documentId);

  const document = await Document.findOneAndDelete({
    _id: new Types.ObjectId(documentId),
    user: new Types.ObjectId(ownerId),
  }).lean();

  if (!document) {
    throw new NotFoundError("File not found");
  }

  await Session.deleteMany({
    user: new Types.ObjectId(ownerId),
    documentId: new Types.ObjectId(documentId),
  });
};

export const setDocumentLastOpenedSession = async (
  userId: string | undefined,
  documentId: string,
  sessionId: string,
): Promise<void> => {
  const ownerId = assertUserId(userId);
  assertValidDocumentId(documentId);

  if (!Types.ObjectId.isValid(sessionId)) {
    throw new ValidationError("Invalid session id");
  }

  const result = await Document.updateOne(
    {
      _id: new Types.ObjectId(documentId),
      user: new Types.ObjectId(ownerId),
    },
    {
      $set: {
        lastOpenedSessionId: new Types.ObjectId(sessionId),
      },
    },
  );

  if (result.matchedCount === 0) {
    throw new NotFoundError("File not found");
  }
};
