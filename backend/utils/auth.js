import jwt from "jsonwebtoken";

const SECRET = process.env.JWT_SECRET || "default_secret_do_not_use";

export function generateToken(user) {
  // user object should contain id, role, etc.
  return jwt.sign(
    { id: user.id, role: user.role, name: user.name },
    SECRET,
    { expiresIn: "24h" }
  );
}

export function verifyToken(token) {
  try {
    return jwt.verify(token, SECRET);
  } catch (err) {
    return null;
  }
}
