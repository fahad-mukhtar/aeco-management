from fastapi import APIRouter

from . import admin, attendance, auth, employees, health, inventory, leaves, payroll, production

api_router = APIRouter()
api_router.include_router(health.router, tags=["health"])
api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(employees.router, prefix="/employees", tags=["employees"])
api_router.include_router(attendance.router, tags=["attendance"])
api_router.include_router(leaves.router, prefix="/leaves", tags=["leaves"])
api_router.include_router(payroll.router, prefix="/payroll", tags=["payroll"])
api_router.include_router(inventory.router, prefix="/inventory", tags=["inventory"])
api_router.include_router(production.router, prefix="/production", tags=["production"])
api_router.include_router(admin.router, prefix="/admin", tags=["admin"])

__all__ = ("api_router",)
