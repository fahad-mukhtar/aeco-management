from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_super_admin
from app.core import get_password_hash
from app.db import (
    User,
    UserRole,
    create_user,
    get_db,
    get_user,
    get_user_by_email,
    list_users,
    set_user_active_state,
    update_user_role,
)
from app.schemas import UserCreate, UserResponse, UserRoleEnum, UserRoleUpdate, UserStatusUpdate

router = APIRouter()


@router.get("/users", response_model=List[UserResponse], summary="List all users")
def admin_list_users(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_super_admin),
) -> List[UserResponse]:
    return list(list_users(db))


@router.post(
    "/users",
    response_model=UserResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new user (default role: admin)",
)
def admin_create_user(
    payload: UserCreate,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_super_admin),
) -> UserResponse:
    if get_user_by_email(db, payload.email):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered",
        )

    role = UserRole(payload.role.value)
    user = create_user(
        db,
        email=payload.email,
        hashed_password=get_password_hash(payload.password),
        role=role,
    )
    return user


@router.patch(
    "/users/{user_id}/role",
    response_model=UserResponse,
    summary="Update a user's role",
)
def admin_update_user_role(
    user_id: int,
    payload: UserRoleUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_super_admin),
) -> UserResponse:
    user = get_user(db, user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    user = update_user_role(db, user, UserRole(payload.role.value))
    return user


@router.patch(
    "/users/{user_id}/status",
    response_model=UserResponse,
    summary="Activate or deactivate a user",
)
def admin_update_user_status(
    user_id: int,
    payload: UserStatusUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_super_admin),
) -> UserResponse:
    user = get_user(db, user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    user = set_user_active_state(db, user, active=payload.is_active)
    return user
