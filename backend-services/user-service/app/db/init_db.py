from sqlalchemy.orm import Session

from app.core import get_password_hash, get_settings

from . import crud, models


def init_db(db: Session) -> None:
    settings = get_settings()

    if crud.get_user_by_email(db, settings.bootstrap_superadmin_email) is None:
        crud.create_user(
            db,
            email=settings.bootstrap_superadmin_email,
            hashed_password=get_password_hash(settings.bootstrap_superadmin_password),
            role=models.UserRole.SUPER_ADMIN,
        )

    if crud.get_user_by_email(db, settings.bootstrap_admin_email) is None:
        crud.create_user(
            db,
            email=settings.bootstrap_admin_email,
            hashed_password=get_password_hash(settings.bootstrap_admin_password),
            role=models.UserRole.ADMIN,
        )
