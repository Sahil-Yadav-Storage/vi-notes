export interface DocumentSummary {
  _id: string;
  name: string;
  updatedAt: string;
  createdAt: string;
}

export interface DocumentDetail extends DocumentSummary {
  content: string;
  lastOpenedSessionId?: string;
}

export interface CreateDocumentInput {
  name: string;
}

export interface RenameDocumentInput {
  name: string;
}

export interface UpdateDocumentContentInput {
  content: string;
}

export interface OpenDocumentSessionResponse {
  document: DocumentDetail;
  sessionId: string;
  resumed: boolean;
}
