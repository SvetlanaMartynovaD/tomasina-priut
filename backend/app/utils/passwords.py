from werkzeug.security import check_password_hash, generate_password_hash

try:
    import bcrypt
except Exception:  # pragma: no cover
    bcrypt = None


def hash_password(password: str) -> str:
    return generate_password_hash(password)


def verify_password(stored_hash: str, password: str) -> bool:
    if not stored_hash or password is None:
        return False

    try:
        return check_password_hash(stored_hash, password)
    except ValueError:
        # Legacy PHP bcrypt hash format from dump: $2y$...
        if stored_hash.startswith('$2y$') and bcrypt is not None:
            normalized = '$2b$' + stored_hash[4:]
            return bcrypt.checkpw(password.encode('utf-8'), normalized.encode('utf-8'))
        return False
