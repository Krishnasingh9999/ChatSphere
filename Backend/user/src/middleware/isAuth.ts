import type {Request, Response, NextFunction} from "express";
import type { IUser } from "../model/User.js";
import jwt, { type JwtPayload } from "jsonwebtoken";

export interface AuthenticatedRequest extends Request{
  user?: IUser;
}


export const isAuth = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      res.status(401).json({
        message: "Please Login - No auth header",
      });
      return;
    }

    const token = authHeader.split(" ")[1];

    if (!token) {
      res.status(401).json({
        message: "Token missing",
      });
      return;
    }

    const jwtSecret = process.env.JWT_SECRET || "aether_jwt_secret_dev_key_123456";
    const decodedValue = jwt.verify(
      token,
      jwtSecret
    ) as JwtPayload & { user: IUser };

    req.user = decodedValue.user;

    next();
  } catch (error) {
    res.status(401).json({
      message: "Please Login - JWT error",
    });
  }
};