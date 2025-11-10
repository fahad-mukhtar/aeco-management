from enum import Enum

from pydantic import BaseModel, EmailStr, Field


class UserRoleEnum(str, Enum):
    SUPER_ADMIN = "super_admin"
    ADMIN = "admin"


class UserResponse(BaseModel):
    id: int
    email: EmailStr
    role: UserRoleEnum
    is_active: bool

    class Config:
        from_attributes = True


class UserCreate(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=8, max_length=128)
    role: UserRoleEnum = UserRoleEnum.ADMIN


class UserRoleUpdate(BaseModel):
    role: UserRoleEnum


class UserStatusUpdate(BaseModel):
    is_active: bool
