import type { Request, Response, NextFunction } from "express";
import jwt, { type JwtPayload } from "jsonwebtoken";

interface IUser extends Document{
  _id: string;
  name: string;
  email: string;
}

export interface AuthenticatedRequest extends Request{
user?: IUser | null;
}

const isAuth = async(req: AuthenticatedRequest, res: Response, next: NextFunction):
Promise<void> => {
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
  
      const jwtSecret = process.env.JWT_SECRET || "aether_jwt_secret_super_secure_key_2026";
      const decodedValue = jwt.verify(
        token,
        jwtSecret
      ) as any;
  
      req.user = decodedValue.user || decodedValue;
  
      next();
    } catch (error) {
      res.status(401).json({
        message: "Please Login - JWT error",
      });
    }
};

export default isAuth;