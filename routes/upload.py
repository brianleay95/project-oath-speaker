from fastapi import APIRouter, File, UploadFile
import pandas as pd
import io
from sqlalchemy import text
from database import engine

router = APIRouter()

@router.post("/upload/")
async def upload_data(file: UploadFile = File(...)):
    try:
        df = pd.read_csv(io.StringIO(file.file.read().decode("utf-8")))
        table_name = file.filename.split(".")[0]
        df.to_sql(table_name, engine, if_exists="replace", index=False)
        return {"message": f"Data from {file.filename} uploaded successfully!", "table": table_name}
    except Exception as e:
        return {"error": str(e)}
