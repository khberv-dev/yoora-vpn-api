import bcrypt from 'bcrypt';

export function hashPassword(password: string) {
  return bcrypt.hash(password, 15);
}

export function comparePassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}
