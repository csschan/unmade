from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    paypal_client_id: str = ""
    paypal_client_secret: str = ""
    paypal_base_url: str = "https://api-m.sandbox.paypal.com"
    anthropic_api_key: str = ""
    jwt_secret: str = "dev-secret-change-in-production"
    database_url: str = "sqlite+aiosqlite:///./unmade.db"

    model_config = {"env_file": ".env"}


settings = Settings()
