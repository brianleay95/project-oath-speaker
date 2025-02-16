from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter()

# Define the request model
class ChatRequest(BaseModel):
    message: str

# Simulated response function
def get_ai_response(user_message: str):
    # Replace this with actual AI logic or API call
    if "usage" in user_message.lower():
        return "Your water usage has been stable this month."
    else:
        return "I'm not sure, please ask something about water usage."

@router.post("/chat")
async def chat_endpoint(request: ChatRequest):
    try:
        response = get_ai_response(request.message)
        return {"response": response}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
