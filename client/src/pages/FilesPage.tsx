import { useMemo, useState } from "react";
import { FileText, FolderPlus, Pencil, Trash2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "../components/ui/button";
import Toast from "../components/Toast";
import { useDocument } from "../hooks/useDocument";

const FilesPage = () => {
  const navigate = useNavigate();
  const {
    documents,
    isLoading,
    error,
    createError,
    renameErrors,
    createDocument,
    renameDocument,
    deleteDocument,
    clearCreateError,
    clearRenameError,
  } = useDocument();

  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [pageError, setPageError] = useState<string | null>(null);

  const isEmpty = useMemo(
    () => !isLoading && documents.length === 0,
    [documents.length, isLoading],
  );

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault();

    const trimmed = newName.trim();
    if (!trimmed) {
      return;
    }

    const created = await createDocument(trimmed);
    if (!created) {
      return;
    }

    setNewName("");
    navigate(`/fileopen?fileId=${created._id}&fileName=${encodeURIComponent(trimmed)}`);
  };

  const handleOpen = (documentId: string, fileName: string) => {
    navigate(`/fileopen?fileId=${documentId}&fileName=${encodeURIComponent(fileName)}`);
  };

  const handleRename = async (documentId: string) => {
    const trimmed = editingName.trim();
    if (!trimmed) {
      return;
    }

    const renamed = await renameDocument(documentId, trimmed);
    if (!renamed) {
      return;
    }

    setEditingId(null);
    setEditingName("");
  };

  const handleDelete = async (documentId: string) => {
    try {
      await deleteDocument(documentId);
      if (editingId === documentId) {
        setEditingId(null);
        setEditingName("");
      }
    } catch {
      setPageError("Failed to delete file.");
    }
  };

  return (
    <section className="files-page">
      <div className="files-header">
        <h1>Files</h1>
        <p>Create named files, switch between them, and continue writing.</p>
      </div>

      <form className="files-create" onSubmit={handleCreate}>
        <label htmlFor="new-file-input" className="sr-only">
          New file name
        </label>
        <input
          id="new-file-input"
          value={newName}
          onChange={(event) => {
            setNewName(event.target.value);
            if (createError) {
              clearCreateError();
            }
          }}
          className="field-input"
          placeholder="New file name"
          aria-label="New file name"
        />
        <Button type="submit">
          <FolderPlus size={16} />
          Create File
        </Button>
      </form>

      {createError && <p className="form-inline-error">{createError}</p>}

      {error && <p className="files-error">{error}</p>}

      {isEmpty && (
        <div className="files-empty-state">
          <h2>No files yet</h2>
          <p>Start your first document to begin capturing your writing flow.</p>
          <Button
            onClick={() => document.getElementById("new-file-input")?.focus()}
          >
            Create your first file
          </Button>
        </div>
      )}

      {!isLoading && documents.length > 0 && (
        <ul className="files-list" aria-label="File list">
          {documents.map((document) => {
            const isEditing = editingId === document._id;

            return (
              <li key={document._id} className="files-item">
                <div className="files-item-main">
                  <span className="files-item-icon">
                    <FileText size={16} />
                  </span>

                  {isEditing ? (
                    <div className="files-rename-area">
                      <label
                        htmlFor={`rename-file-${document._id}`}
                        className="sr-only"
                      >
                        Rename {document.name}
                      </label>
                      <input
                        id={`rename-file-${document._id}`}
                        className="field-input"
                        value={editingName}
                        placeholder="Rename file"
                        aria-label={`Rename ${document.name}`}
                        onChange={(event) => {
                          setEditingName(event.target.value);
                          clearRenameError(document._id);
                        }}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            event.preventDefault();
                            void handleRename(document._id);
                          }
                        }}
                        autoFocus
                      />
                      {renameErrors[document._id] && (
                        <p className="form-inline-error">
                          {renameErrors[document._id]}
                        </p>
                      )}
                    </div>
                  ) : (
                    <button
                      type="button"
                      className="files-open-link"
                      onClick={() => handleOpen(document._id, document.name)}
                    >
                      {document.name}
                    </button>
                  )}
                </div>

                <div className="files-item-actions">
                  {isEditing ? (
                    <>
                      <Button
                        size="sm"
                        onClick={() => void handleRename(document._id)}
                      >
                        Save
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setEditingId(null);
                          setEditingName("");
                        }}
                      >
                        Cancel
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleOpen(document._id, document.name)}
                      >
                        Open
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setEditingId(document._id);
                          setEditingName(document.name);
                        }}
                      >
                        <Pencil size={14} />
                        Rename
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => void handleDelete(document._id)}
                      >
                        <Trash2 size={14} />
                        Delete
                      </Button>
                    </>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {pageError && (
        <Toast
          message={pageError}
          type="error"
          onClose={() => setPageError(null)}
        />
      )}
    </section>
  );
};

export default FilesPage;
