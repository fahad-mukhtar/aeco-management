import os
import subprocess

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import api_router
from app.core import get_settings
from app.db import Base, SessionLocal, engine
from app.db.init_db import init_db


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(title=settings.app_name, version="0.1.0", debug=settings.debug)

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(api_router)

    @app.on_event("startup")
    def on_startup() -> None:
        try:
            subprocess.run(
                ["alembic", "upgrade", "head"],
                check=True,
                cwd="/app",
                capture_output=True,
                text=True,
                env={**os.environ, "PYTHONPATH": "/app"},
            )
        except subprocess.CalledProcessError as exc:
            # Alembic failure should prevent the app from starting with inconsistent schema.
            raise RuntimeError(
                "Alembic migration failed.\n"
                f"STDOUT:\n{exc.stdout}\nSTDERR:\n{exc.stderr}\n"
            ) from exc
        Base.metadata.create_all(bind=engine)
        with SessionLocal() as session:
            init_db(session)

    return app


app = create_app()
