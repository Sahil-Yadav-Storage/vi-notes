import express from "express";
import Session from "../models/Session.js";
import Document from "../models/Document.js";
import { authMiddleware } from "../middleware/authMiddleware.js";
import { Types } from "mongoose";

const router = express.Router();

// GET endpoint to fetch analytics for a specific document
router.get("/:documentId", authMiddleware, async (req, res) => {
  try {
    const { documentId } = req.params;
    const userId = req.userId;

    // Validate documentId is a valid MongoDB ObjectId
    if (!Types.ObjectId.isValid(documentId)) {
      return res.status(400).json({ error: "Invalid document ID" });
    }

    // Fetch the document
    const document = await Document.findOne({
      _id: new Types.ObjectId(documentId),
      owner: new Types.ObjectId(userId),
    });

    if (!document) {
      return res.status(404).json({ error: "Document not found" });
    }

    // Fetch all sessions for this document
    const sessions = await Session.find({
      documentId: new Types.ObjectId(documentId),
      user: new Types.ObjectId(userId),
    });

    // Calculate analytics from sessions and document content
    const wordCount = document.content
      .split(/\s+/)
      .filter((word) => word.length > 0).length;
    const charCount = document.content.length;
    const totalSessions = sessions.length;
    const totalKeystrokes = sessions.reduce((sum, session) => {
      // Sum up keystrokes from all sessions (if they have keystroke data)
      return sum + (session.keystrokes?.length || 0);
    }, 0);

    // Placeholder for AI probability (would call actual AI service in production)
    const aiProbability = Math.floor(Math.random() * 100);

    // Generate suggestions based on content length
    const suggestions = [];
    if (wordCount < 100) {
      suggestions.push(
        "Your document is relatively short. Consider adding more content.",
      );
    }
    if (wordCount > 2000) {
      suggestions.push(
        "This is a lengthy document. Consider breaking it into sections.",
      );
    }
    if (charCount > 0 && wordCount / charCount > 0.2) {
      suggestions.push(
        "Consider using shorter paragraphs for better readability.",
      );
    }
    if (suggestions.length === 0) {
      suggestions.push("Great job! Your document is well-structured.");
    }

    const analyticsResult = {
      aiProbability,
      wordCount,
      charCount,
      totalSessions,
      totalKeystrokes,
      suggestions,
    };

    res.json(analyticsResult);
  } catch (error) {
    console.error("Error generating analytics:", error);
    res.status(500).json({ error: "Failed to generate analytics." });
  }
});

export default router;
