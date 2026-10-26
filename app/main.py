"""
FastAPI Application Entry Point.

Initializes the FastAPI application, registers middleware (CORS),
mounts API routers, and defines root/health endpoints.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

from app.core.config import settings
from app.api.v1.endpoints import health
from app.api.v1.router import api_v1_router


def create_application() -> FastAPI:
    """
    Application factory that configures and returns the FastAPI instance.
    """
    application = FastAPI(
        title=settings.PROJECT_NAME,
        version=settings.VERSION,
        description="Backend API for the News Bias and Framing Analysis System.",
        debug=settings.DEBUG,
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

    # Versioned API routes accessible at /api/v1 (e.g., /api/v1/health)
    application.include_router(api_v1_router, prefix=settings.API_V1_PREFIX)

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
