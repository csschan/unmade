from fastapi import APIRouter, Request

router = APIRouter()


@router.post("/paypal")
async def paypal_webhook(request: Request):
    body = await request.json()
    event_type = body.get("event_type", "")

    if event_type == "PAYMENT.CAPTURE.COMPLETED":
        # Mark project as sold, trigger payout
        pass
    elif event_type == "PAYMENT.PAYOUTS-ITEM.SUCCEEDED":
        # Mark attribution as completed
        pass
    elif event_type == "PAYMENT.PAYOUTS-ITEM.FAILED":
        # Mark attribution as failed
        pass

    return {"status": "received"}
