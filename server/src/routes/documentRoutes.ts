import express from "express";
import {
  createDocumentByName,
  getDocument,
  getDocuments,
  openDocument,
  patchDocumentContent,
  patchDocumentName,
  removeDocument,
} from "../controllers/documentController.js";
import { authMiddleware } from "../middleware/authMiddleware.js";

const router = express.Router();

router.get("/", authMiddleware, getDocuments);
router.post("/", authMiddleware, createDocumentByName);
router.get("/:id", authMiddleware, getDocument);
router.post("/:id/open", authMiddleware, openDocument);
router.patch("/:id/content", authMiddleware, patchDocumentContent);
router.patch("/:id/rename", authMiddleware, patchDocumentName);
router.delete("/:id", authMiddleware, removeDocument);

export default router;
