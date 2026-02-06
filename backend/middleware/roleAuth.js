import { verifyToken } from "../utils/auth.js";

export function requireRole(roles = []) {
  return (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ error: "No token provided" });
    }

    const token = authHeader.split(" ")[1];
    const user = verifyToken(token);

    if (!user) {
      return res.status(401).json({ error: "Invalid token" });
    }

    if (roles.length && !roles.includes(user.role)) {
      return res.status(403).json({ error: "Forbidden: Insufficient permissions" });
    }

    req.user = user;
    req.userRole = user.role;
    next();
  };
}
