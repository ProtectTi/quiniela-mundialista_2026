import bcrypt from "bcrypt";
import crypto from "crypto";

export async function comparePassword(plainPassword, storedHash) {
  if (!plainPassword || !storedHash) return false;

  if (storedHash.startsWith("$2")) {
    return bcrypt.compare(plainPassword, storedHash);
  }

  const md5 = crypto.createHash("md5").update(plainPassword).digest("hex");
  return md5 === storedHash;
}
