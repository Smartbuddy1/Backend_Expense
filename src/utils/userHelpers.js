// Strips the password hash before sending a user object to the client.
// Single source of truth — imported by auth.js and users.js so neither
// copy can silently diverge if the User model gains new sensitive fields.
function toSafeUser(user) {
  const { passwordHash, ...safe } = user;
  return safe;
}

module.exports = { toSafeUser };
