from fastapi import APIRouter, HTTPException, status

from app.schemas import InventoryItem

router = APIRouter()

_IN_MEMORY_ITEMS: dict[int, InventoryItem] = {
    1: InventoryItem(id=1, sku="WIDGET-001", quantity=120, location="A1"),
    2: InventoryItem(id=2, sku="WIDGET-002", quantity=45, location="B3"),
}


@router.get("/", response_model=list[InventoryItem], summary="List inventory items")
def list_items() -> list[InventoryItem]:
    return list(_IN_MEMORY_ITEMS.values())


@router.get(
    "/{item_id}",
    response_model=InventoryItem,
    summary="Retrieve an inventory item",
)
def get_item(item_id: int) -> InventoryItem:
    try:
        return _IN_MEMORY_ITEMS[item_id]
    except KeyError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Item {item_id} not found",
        ) from exc
