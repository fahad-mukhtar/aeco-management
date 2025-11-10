from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from app.core import decode_access_token
from app.db import User, UserRole, get_db, get_user
from app.schemas import TokenPayload

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")


def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload_dict = decode_access_token(token)
        payload = TokenPayload.model_validate(payload_dict)
    except ValueError as exc:  # decode_access_token raised ValueError
        raise credentials_exception from exc
    except Exception as exc:
        raise credentials_exception from exc

    if payload.sub is None:
        raise credentials_exception
    try:
        user_id = int(payload.sub)
    except ValueError as exc:
        raise credentials_exception from exc

    user = get_user(db, user_id)
    if not user:
        raise credentials_exception
    return user


def get_current_active_user(current_user: User = Depends(get_current_user)) -> User:
    if not current_user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Inactive user")
    return current_user


def get_current_super_admin(current_user: User = Depends(get_current_active_user)) -> User:
    if current_user.role != UserRole.SUPER_ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Super admin privileges required",
        )
    return current_user
