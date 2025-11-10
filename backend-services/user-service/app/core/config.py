from functools import lru_cache

from pydantic import computed_field, Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "Factory Management API"
    debug: bool = True
    cors_origins: list[str] = ["http://localhost:5173", "http://localhost:3001"]

    jwt_secret_key: str = "dev-secret"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 30

    database_host: str = "postgres"
    database_port: int = 5432
    database_user: str = "factory_admin"
    database_password: str = "factory_admin"
    database_name: str = "factory_auth"
    database_url_override: str | None = Field(default=None, alias="DATABASE_URL")

    bootstrap_superadmin_email: str = "superadmin@example.com"
    bootstrap_superadmin_password: str = "SuperSecure123!"
    bootstrap_admin_email: str = "admin@example.com"
    bootstrap_admin_password: str = "AdminSecure123!"

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        env_prefix="USER_SERVICE_",
    )

    @computed_field
    @property
    def database_url(self) -> str:
        if self.database_url_override:
            return self.database_url_override
        return (
            f"postgresql+psycopg://{self.database_user}:{self.database_password}"
            f"@{self.database_host}:{self.database_port}/{self.database_name}"
        )


@lru_cache
def get_settings() -> Settings:
    return Settings()
