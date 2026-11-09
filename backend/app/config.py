from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    paypal_client_id: str = ""
    paypal_client_secret: str = ""
    paypal_base_url: str = "https://api-m.sandbox.paypal.com"
    anthropic_api_key: str = ""
    jwt_secret: str = "dev-secret-change-in-production"
    database_url: str = "sqlite+aiosqlite:///./unmade.db"
    use_mock: bool = False          # mock AI (Claude) calls
    use_mock_paypal: bool = False   # mock PayPal — set False to hit real sandbox

    @property
    def mock_paypal(self) -> bool:
        """True if PayPal should be mocked. Respects use_mock_paypal override."""
        return self.use_mock_paypal

    model_config = {"env_file": ".env"}


settings = Settings()
