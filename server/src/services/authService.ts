import bcrypt from "bcrypt";
import { createHash, randomUUID } from "crypto";
import jwt from "jsonwebtoken";
import { Types } from "mongoose";
import User from "../models/User.js";
import { config } from "../config.js";
import RefreshToken from "../models/RefreshToken.js";
import { ConflictError, UnauthorizedError, ValidationError } from "./errors.js";

interface RefreshTokenPayload {
  userId: string;
  tokenId: string;
}

interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

const hashToken = (token: string): string => {
  return createHash("sha256").update(token).digest("hex");
};

const createAccessToken = (userId: string): string => {
  const expiresIn = config.JWT_ACCESS_EXPIRES_IN as Exclude<
    jwt.SignOptions["expiresIn"],
    undefined
  >;

  return jwt.sign({ userId }, config.JWT_SECRET, {
    expiresIn,
  });
};

const createRefreshToken = (
  userId: string,
): {
  refreshToken: string;
  tokenId: string;
  tokenHash: string;
  expiresAt: Date;
} => {
  const tokenId = randomUUID();
  const refreshExpiresIn = `${config.REFRESH_TOKEN_TTL_DAYS}d` as Exclude<
    jwt.SignOptions["expiresIn"],
    undefined
  >;
  const refreshToken = jwt.sign(
    { userId, tokenId },
    config.JWT_REFRESH_SECRET,
    {
      expiresIn: refreshExpiresIn,
    },
  );

  return {
    refreshToken,
    tokenId,
    tokenHash: hashToken(refreshToken),
    expiresAt: new Date(
      Date.now() + config.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000,
    ),
  };
};

const verifyRefreshJwt = (token: string): RefreshTokenPayload => {
  try {
    const decoded = jwt.verify(token, config.JWT_REFRESH_SECRET);

    if (
      !decoded ||
      typeof decoded !== "object" ||
      !("userId" in decoded) ||
      !("tokenId" in decoded)
    ) {
      throw new UnauthorizedError("Invalid refresh token");
    }

    const userId = decoded.userId;
    const tokenId = decoded.tokenId;

    if (
      typeof userId !== "string" ||
      userId.trim() === "" ||
      typeof tokenId !== "string" ||
      tokenId.trim() === ""
    ) {
      throw new UnauthorizedError("Invalid refresh token");
    }

    return { userId, tokenId };
  } catch {
    throw new UnauthorizedError("Invalid refresh token");
  }
};

const persistRefreshToken = async (
  userId: string,
  tokenData: { tokenId: string; tokenHash: string; expiresAt: Date },
) => {
  await RefreshToken.create({
    user: new Types.ObjectId(userId),
    tokenId: tokenData.tokenId,
    tokenHash: tokenData.tokenHash,
    expiresAt: tokenData.expiresAt,
  });
};

export const registerUser = async (
  email: string,
  password: string,
): Promise<void> => {
  const existing = await User.findOne({ email });
  if (existing) {
    throw new ConflictError("User already exists");
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  const user = new User({
    email,
    password: hashedPassword,
  });

  await user.save();
};

export const loginUser = async (
  email: string,
  password: string,
): Promise<AuthTokens> => {
  const user = await User.findOne({ email });
  if (!user) {
    throw new ValidationError("Invalid credentials");
  }

  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) {
    throw new ValidationError("Invalid credentials");
  }

  const userId = user._id.toString();
  const accessToken = createAccessToken(userId);
  const refreshTokenData = createRefreshToken(userId);

  await persistRefreshToken(userId, refreshTokenData);

  return {
    accessToken,
    refreshToken: refreshTokenData.refreshToken,
  };
};

export const rotateRefreshToken = async (
  refreshToken: string,
): Promise<AuthTokens> => {
  const payload = verifyRefreshJwt(refreshToken);
  const tokenHash = hashToken(refreshToken);

  const existingToken = await RefreshToken.findOne({
    tokenHash,
    tokenId: payload.tokenId,
    user: new Types.ObjectId(payload.userId),
  });

  if (!existingToken || existingToken.revokedAt) {
    throw new UnauthorizedError("Invalid refresh token");
  }

  if (existingToken.expiresAt.getTime() <= Date.now()) {
    throw new UnauthorizedError("Refresh token expired");
  }

  const nextRefreshTokenData = createRefreshToken(payload.userId);

  existingToken.revokedAt = new Date();
  existingToken.replacedByTokenHash = nextRefreshTokenData.tokenHash;

  await existingToken.save();
  await persistRefreshToken(payload.userId, nextRefreshTokenData);

  return {
    accessToken: createAccessToken(payload.userId),
    refreshToken: nextRefreshTokenData.refreshToken,
  };
};

export const revokeRefreshToken = async (
  refreshToken: string,
): Promise<void> => {
  const tokenHash = hashToken(refreshToken);

  await RefreshToken.deleteOne({ tokenHash });
};

export const verifyAccessToken = (token: string): { userId: string } => {
  try {
    const decoded = jwt.verify(token, config.JWT_SECRET);

    if (!decoded || typeof decoded !== "object" || !("userId" in decoded)) {
      throw new UnauthorizedError("Invalid token");
    }

    const userId = decoded.userId;
    if (typeof userId !== "string" || userId.trim() === "") {
      throw new UnauthorizedError("Invalid token");
    }

    return { userId };
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      throw error;
    }

    if (error instanceof jwt.TokenExpiredError) {
      throw new UnauthorizedError("Token expired");
    }

    if (error instanceof jwt.JsonWebTokenError) {
      throw new UnauthorizedError("Invalid token signature");
    }

    throw new UnauthorizedError("Invalid token");
  }
};
