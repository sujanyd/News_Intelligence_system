"""
FastAPI Application Entry Point.

Initializes the FastAPI application, registers middleware (CORS),
mounts API routers, and defines root/health endpoints.
"""

from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

from app.core.config import settings
from app.api.v1.endpoints import health
from app.api.v1.router import api_v1_router
from app.db.session import SessionLocal
from app.models.article import Article
from app.models.article_embedding import ArticleEmbedding
from app.services.embedding import get_embedding_provider
from app.services.vector_db import get_vector_db_service


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Application lifespan context manager.
    Warms up in-memory Qdrant with existing database embeddings on startup for local demo reliability.
    """
    try:
        db = SessionLocal()
        vec_service = get_vector_db_service()
        provider = get_embedding_provider()
        embeddings = db.query(ArticleEmbedding).all()
        for emb in embeddings:
            try:
                existing = vec_service.get_vector_by_id(emb.vector_reference)
                if existing is None:
                    art = db.query(Article).filter_by(id=emb.article_id).first()
                    if art:
                        text = art.title if emb.embedding_type == "headline" else (art.content or art.title)
                        gen_vec = provider.embed_text(text)
                        vec_service.store_vector(
                            vector_id=emb.vector_reference,
                            article_id=emb.article_id,
                            vector=gen_vec.vector,
                            embedding_type=emb.embedding_type,
                            model_name=emb.model_name,
                        )
            except Exception:
                pass
        db.close()
    except Exception:
        pass
    yield


def create_application() -> FastAPI:
    """
    Application factory that configures and returns the FastAPI instance.
    """
    application = FastAPI(
        title=settings.PROJECT_NAME,
        version=settings.VERSION,
        description="Backend API for the News Bias and Framing Analysis System.",
        debug=settings.DEBUG,
        lifespan=lifespan,
    )

    # Enable Cross-Origin Resource Sharing (CORS) for local frontend development
    application.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Health check endpoint directly accessible at /health
    application.include_router(health.router)

    # Versioned API routes accessible at /api/v1 (e.g., /api/v1/sources, /api/v1/articles)
    application.include_router(api_v1_router, prefix=settings.API_V1_PREFIX)

    # API routes accessible at /api (e.g., /api/sources, /api/articles) matching frontend default prefix
    application.include_router(api_v1_router, prefix="/api")

    @application.get("/", tags=["Root"])
    async def root():
        """
        Root endpoint providing navigation links to API documentation and health status.
        """
        return {
            "message": f"Welcome to {settings.PROJECT_NAME} API",
            "docs_url": "/docs",
            "health_url": "/health",
            "version": settings.VERSION,
        }

    return application


app = create_application()

if __name__ == "__main__":
    uvicorn.run(
        "app.main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=settings.DEBUG,
    )
