from datetime import datetime
from typing import Optional

from pydantic import BaseModel, EmailStr, Field

from .user import UserResponse, UserRoleEnum


class LoginRequest(BaseModel):
    email: EmailStr = Field(..., examples=["admin@example.com"])
    password: str = Field(..., min_length=8, max_length=128)


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse


class TokenPayload(BaseModel):
    sub: str
    exp: datetime
    role: Optional[UserRoleEnum] = None
    email: Optional[EmailStr] = None
