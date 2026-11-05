import httpx

from app.config import settings


async def get_access_token() -> str:
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            f"{settings.paypal_base_url}/v1/oauth2/token",
            data={"grant_type": "client_credentials"},
            auth=(settings.paypal_client_id, settings.paypal_client_secret),
            headers={"Content-Type": "application/x-www-form-urlencoded"},
        )
        resp.raise_for_status()
        return resp.json()["access_token"]


async def create_order(amount_usd: str, description: str) -> dict:
    token = await get_access_token()
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            f"{settings.paypal_base_url}/v2/checkout/orders",
            json={
                "intent": "CAPTURE",
                "purchase_units": [
                    {
                        "amount": {"currency_code": "USD", "value": amount_usd},
                        "description": description,
                    }
                ],
            },
            headers={
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json",
            },
        )
        resp.raise_for_status()
        return resp.json()


async def capture_order(order_id: str) -> dict:
    token = await get_access_token()
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            f"{settings.paypal_base_url}/v2/checkout/orders/{order_id}/capture",
            headers={
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json",
            },
        )
        resp.raise_for_status()
        return resp.json()


async def create_payout(batch_id: str, items: list[dict]) -> dict:
    """
    items: [{"email": "x@y.com", "amount": "10.00", "note": "..."}]
    """
    token = await get_access_token()
    payout_items = [
        {
            "recipient_type": "EMAIL",
            "amount": {"value": item["amount"], "currency": "USD"},
            "receiver": item["email"],
            "note": item.get("note", "UNMADE earnings"),
            "sender_item_id": f"{batch_id}_{i}",
        }
        for i, item in enumerate(items)
    ]
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            f"{settings.paypal_base_url}/v1/payments/payouts",
            json={
                "sender_batch_header": {
                    "sender_batch_id": batch_id,
                    "email_subject": "You earned money on UNMADE",
                    "email_message": "Your knowledge contribution has been purchased.",
                },
                "items": payout_items,
            },
            headers={
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json",
            },
        )
        resp.raise_for_status()
        return resp.json()
