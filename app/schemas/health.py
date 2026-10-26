"""
Pydantic schemas for the Health Check endpoint.

Schemas validate input data and serialize output responses in FastAPI.
"""

from pydantic import BaseModel, Field


class HealthCheckResponse(BaseModel):
    """
    Response model for the GET /health endpoint.
    """
    status: str = Field(default="ok", description="Operational status of the API")
    app_name: str = Field(..., description="Name of the application")
    environment: str = Field(..., description="Current running environment")
    version: str = Field(..., description="API version")

    model_config = {
        "json_schema_extra": {
            "example": {
                "status": "ok",
                "app_name": "News Bias and Framing Analysis System",
                "environment": "development",
                "version": "0.1.0",
            }
        }
    }
