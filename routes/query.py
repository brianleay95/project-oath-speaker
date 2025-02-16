from fastapi import APIRouter, Query, HTTPException
from database import engine
from sqlalchemy import text

router = APIRouter()

# Ensure the correct table name is allowed
ALLOWED_TABLES = {"water_meter_readings"}

@router.get("/query/")
async def query_data(table_name: str, status: str):
    if table_name not in ALLOWED_TABLES:
        raise HTTPException(status_code=400, detail="Invalid table name")

    with engine.connect() as connection:
        query = text(f"SELECT * FROM {table_name} WHERE Status = :status")
        result = connection.execute(query, {"status": status}).fetchall()

        if not result:
            return {"data": []}  # Return an empty array if there's no data

        column_names = result[0]._fields  # Use `_fields` instead of `keys()` for named tuples
        data = [dict(zip(column_names, row)) for row in result]

        return {"data": data}
