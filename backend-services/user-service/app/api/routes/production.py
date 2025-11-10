from datetime import datetime, timedelta

from fastapi import APIRouter, HTTPException, status

from app.schemas import ProductionOrder

router = APIRouter()

_IN_MEMORY_ORDERS: dict[int, ProductionOrder] = {
    1001: ProductionOrder(
        id=1001,
        product_code="WIDGET-001",
        scheduled_start=datetime.utcnow(),
        scheduled_end=datetime.utcnow() + timedelta(hours=4),
        quantity=100,
        status="scheduled",
    )
}


@router.get(
    "/orders",
    response_model=list[ProductionOrder],
    summary="List production orders",
)
def list_orders() -> list[ProductionOrder]:
    return list(_IN_MEMORY_ORDERS.values())


@router.get(
    "/orders/{order_id}",
    response_model=ProductionOrder,
    summary="Get a production order",
)
def get_order(order_id: int) -> ProductionOrder:
    try:
        return _IN_MEMORY_ORDERS[order_id]
    except KeyError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Order {order_id} not found",
        ) from exc
