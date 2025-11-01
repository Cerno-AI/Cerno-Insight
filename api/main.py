import os

os.environ["KMP_DUPLICATE_LIB_OK"] = "TRUE"

from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from starlette.middleware.cors import CORSMiddleware
import torch

from api.routes.v1_router import v1_router
from api.settings import api_settings
from api.state import ml_models  # <-- Import from the neutral state file
from .core.embedding_manager import OptimizedEmbeddingManager





@asynccontextmanager
async def lifespan(app: FastAPI):
    print("--- Server starting up ---")

    # Instantiate the optimized embedding manager
    manager = OptimizedEmbeddingManager()
    print(f"Embedding manager initialized on device: {manager.device}")

    # Store manager in shared state
    ml_models["embedding_manager"] = manager
    print("✅ Embedding manager loaded successfully.")
    
    print(ml_models)

    yield

    print("--- Server shutting down ---")
    ml_models.clear()


def create_app() -> FastAPI:
    """Create a FastAPI App"""
    app: FastAPI = FastAPI(
        title=api_settings.title,
        version=api_settings.version,
        docs_url="/docs" if api_settings.docs_enabled else None,
        redoc_url="/redoc" if api_settings.docs_enabled else None,
        openapi_url="/openapi.json" if api_settings.docs_enabled else None,
        lifespan=lifespan,  # <-- Use the new lifespan manager
    )

    app.include_router(v1_router, prefix="/api")

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["http://localhost:3000", "http://127.0.0.1:3000", "*"],  # Allow frontend
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    
    # Check if frontend build exists and serve static files
    frontend_build_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "frontend", "out")
    if os.path.exists(frontend_build_path):
        # Mount the static files
        app.mount("/static", StaticFiles(directory=os.path.join(frontend_build_path, "_next", "static")), name="static")
        
        # Serve the main app
        @app.get("/")
        async def serve_frontend():
            return FileResponse(os.path.join(frontend_build_path, "index.html"))
        
        # Handle all other routes by serving the frontend
        @app.get("/{path:path}")
        async def serve_frontend_routes(path: str):
            file_path = os.path.join(frontend_build_path, path)
            if os.path.isfile(file_path):
                return FileResponse(file_path)
            # For client-side routing, serve index.html
            return FileResponse(os.path.join(frontend_build_path, "index.html"))
    
    return app


app = create_app()
