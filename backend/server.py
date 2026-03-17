from fastapi import FastAPI, APIRouter, HTTPException, Depends, UploadFile, File
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional
import uuid
from datetime import datetime, timezone, timedelta
import jwt
import bcrypt
import base64

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ.get('DB_NAME', 'test_database')]

# JWT Configuration
JWT_SECRET = os.environ.get('JWT_SECRET', 'nutrition-cost-analyzer-secret-key-2024')
JWT_ALGORITHM = "HS256"
JWT_EXPIRATION_HOURS = 24

# Create the main app
app = FastAPI(title="Nutrition Cost Analyzer API")
api_router = APIRouter(prefix="/api")
security = HTTPBearer()

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# ==================== MODELS ====================

class UserCreate(BaseModel):
    email: EmailStr
    password: str
    name: str

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserResponse(BaseModel):
    id: str
    email: str
    name: str
    created_at: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse

class FoodItem(BaseModel):
    name: str
    calories: int
    price: float
    calories_per_dollar: float
    quantity: Optional[str] = None

class ExtractRequest(BaseModel):
    receipt_text: Optional[str] = None
    receipt_image_base64: Optional[str] = None

class ExtractedItem(BaseModel):
    name: str
    calories: int
    price: float
    quantity: Optional[str] = None

class AnalysisFromItemsRequest(BaseModel):
    items: List[ExtractedItem]

class AnalysisRequest(BaseModel):
    receipt_text: Optional[str] = None
    receipt_image_base64: Optional[str] = None

class AnalysisResult(BaseModel):
    id: str
    user_id: str
    items: List[FoodItem]
    total_calories: int
    total_cost: float
    avg_calories_per_dollar: float
    best_value_items: List[str]
    worst_value_items: List[str]
    insights: List[str]
    created_at: str

class AnalysisHistory(BaseModel):
    id: str
    total_calories: int
    total_cost: float
    avg_calories_per_dollar: float
    item_count: int
    created_at: str

# ==================== MEAL TRACKING MODELS ====================

class MealEntryCreate(BaseModel):
    item_name: str
    calories_per_100g: int  # Calories per 100 grams
    total_grams: float  # Total weight of the item purchased
    grams_consumed: float  # How many grams eaten
    total_price: float  # Price of the entire item
    source: str  # 'receipt' or 'database'
    source_id: Optional[str] = None  # analysis_id if from receipt

class MealEntry(BaseModel):
    id: str
    item_name: str
    calories_consumed: int
    cost: float
    grams_consumed: float
    total_grams: float
    calories_per_100g: int
    source: str
    timestamp: str

class DailySummary(BaseModel):
    date: str
    total_calories: int
    total_cost: float
    meal_count: int
    entries: List[MealEntry]

class CalendarDay(BaseModel):
    date: str
    total_calories: int
    total_cost: float
    meal_count: int

# ==================== CALORIE DATABASE ====================

CALORIE_DATABASE = {
    # Dairy & Eggs
    "eggs": {"calories_per_unit": 70, "unit": "egg", "typical_quantity": 12},
    "milk": {"calories_per_unit": 150, "unit": "cup", "typical_quantity": 8},
    "cheese": {"calories_per_unit": 110, "unit": "oz", "typical_quantity": 8},
    "butter": {"calories_per_unit": 100, "unit": "tbsp", "typical_quantity": 16},
    "yogurt": {"calories_per_unit": 150, "unit": "container", "typical_quantity": 4},
    "cream cheese": {"calories_per_unit": 100, "unit": "oz", "typical_quantity": 8},
    
    # Bread & Grains
    "bread": {"calories_per_unit": 80, "unit": "slice", "typical_quantity": 20},
    "rice": {"calories_per_unit": 200, "unit": "cup", "typical_quantity": 10},
    "pasta": {"calories_per_unit": 200, "unit": "cup cooked", "typical_quantity": 8},
    "oatmeal": {"calories_per_unit": 150, "unit": "cup", "typical_quantity": 13},
    "cereal": {"calories_per_unit": 120, "unit": "serving", "typical_quantity": 12},
    "tortilla": {"calories_per_unit": 140, "unit": "tortilla", "typical_quantity": 10},
    "bagel": {"calories_per_unit": 270, "unit": "bagel", "typical_quantity": 6},
    
    # Meat & Protein
    "chicken": {"calories_per_unit": 165, "unit": "100g", "typical_quantity": 10},
    "beef": {"calories_per_unit": 250, "unit": "100g", "typical_quantity": 10},
    "pork": {"calories_per_unit": 240, "unit": "100g", "typical_quantity": 10},
    "ground beef": {"calories_per_unit": 250, "unit": "100g", "typical_quantity": 10},
    "bacon": {"calories_per_unit": 43, "unit": "slice", "typical_quantity": 16},
    "sausage": {"calories_per_unit": 170, "unit": "link", "typical_quantity": 8},
    "turkey": {"calories_per_unit": 145, "unit": "100g", "typical_quantity": 10},
    "ham": {"calories_per_unit": 145, "unit": "100g", "typical_quantity": 8},
    "fish": {"calories_per_unit": 130, "unit": "100g", "typical_quantity": 5},
    "salmon": {"calories_per_unit": 180, "unit": "100g", "typical_quantity": 5},
    "tuna": {"calories_per_unit": 130, "unit": "can", "typical_quantity": 1},
    
    # Fruits
    "apple": {"calories_per_unit": 95, "unit": "apple", "typical_quantity": 6},
    "banana": {"calories_per_unit": 105, "unit": "banana", "typical_quantity": 6},
    "orange": {"calories_per_unit": 62, "unit": "orange", "typical_quantity": 6},
    "grapes": {"calories_per_unit": 62, "unit": "cup", "typical_quantity": 4},
    "strawberries": {"calories_per_unit": 50, "unit": "cup", "typical_quantity": 3},
    "blueberries": {"calories_per_unit": 85, "unit": "cup", "typical_quantity": 2},
    
    # Vegetables
    "potato": {"calories_per_unit": 160, "unit": "potato", "typical_quantity": 5},
    "tomato": {"calories_per_unit": 22, "unit": "tomato", "typical_quantity": 6},
    "lettuce": {"calories_per_unit": 10, "unit": "cup", "typical_quantity": 12},
    "carrot": {"calories_per_unit": 25, "unit": "carrot", "typical_quantity": 10},
    "broccoli": {"calories_per_unit": 55, "unit": "cup", "typical_quantity": 4},
    "onion": {"calories_per_unit": 44, "unit": "onion", "typical_quantity": 3},
    "spinach": {"calories_per_unit": 7, "unit": "cup", "typical_quantity": 10},
    
    # Canned/Packaged
    "beans": {"calories_per_unit": 240, "unit": "can", "typical_quantity": 1},
    "soup": {"calories_per_unit": 150, "unit": "can", "typical_quantity": 1},
    "peanut butter": {"calories_per_unit": 190, "unit": "tbsp", "typical_quantity": 16},
    
    # Beverages
    "juice": {"calories_per_unit": 120, "unit": "cup", "typical_quantity": 8},
    "soda": {"calories_per_unit": 140, "unit": "can", "typical_quantity": 12},
    "coffee": {"calories_per_unit": 2, "unit": "cup", "typical_quantity": 30},
    
    # Snacks
    "chips": {"calories_per_unit": 150, "unit": "serving", "typical_quantity": 10},
    "cookies": {"calories_per_unit": 160, "unit": "serving", "typical_quantity": 8},
    "crackers": {"calories_per_unit": 130, "unit": "serving", "typical_quantity": 12},
    "nuts": {"calories_per_unit": 170, "unit": "oz", "typical_quantity": 8},
    "almonds": {"calories_per_unit": 170, "unit": "oz", "typical_quantity": 8},
}

# ==================== AUTH HELPERS ====================

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()

def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode(), hashed.encode())

def create_token(user_id: str) -> str:
    payload = {
        "user_id": user_id,
        "exp": datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRATION_HOURS),
        "iat": datetime.now(timezone.utc)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        payload = jwt.decode(credentials.credentials, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user_id = payload.get("user_id")
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid token")
        
        user = await db.users.find_one({"id": user_id}, {"_id": 0})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

# ==================== AI ANALYSIS HELPERS ====================

def normalize_item_name(name: str) -> str:
    """Normalize item names for calorie lookup."""
    name = name.lower().strip()
    # Remove common descriptors
    remove_words = ["large", "small", "medium", "organic", "fresh", "frozen", 
                    "whole", "sliced", "diced", "canned", "bag", "box", "pack",
                    "lb", "oz", "kg", "ct", "count", "dozen", "gallon", "quart"]
    for word in remove_words:
        name = name.replace(word, "")
    return " ".join(name.split())

def estimate_calories_from_database(item_name: str) -> Optional[dict]:
    """Try to estimate calories from built-in database."""
    normalized = normalize_item_name(item_name)
    
    for key, data in CALORIE_DATABASE.items():
        if key in normalized or normalized in key:
            total_calories = data["calories_per_unit"] * data["typical_quantity"]
            return {
                "name": item_name,
                "calories": total_calories,
                "source": "database",
                "unit_info": f"{data['typical_quantity']} {data['unit']}s @ {data['calories_per_unit']} cal each"
            }
    return None

async def analyze_receipt_with_ai(text: str = None, image_base64: str = None) -> dict:
    """Use GPT-5.2 to analyze receipt and estimate calories."""
    from emergentintegrations.llm.chat import LlmChat, UserMessage, ImageContent
    
    api_key = os.environ.get('EMERGENT_LLM_KEY')
    if not api_key:
        raise HTTPException(status_code=500, detail="AI service not configured")
    
    chat = LlmChat(
        api_key=api_key,
        session_id=str(uuid.uuid4()),
        system_message="""You are a nutrition analyst. Analyze grocery receipts and:
1. Extract all food items with their prices
2. Estimate total calories for each item based on typical serving sizes
3. Ignore non-food items, taxes, and totals

Return a JSON object with this exact structure:
{
    "items": [
        {
            "name": "normalized item name",
            "price": 4.99,
            "calories": 840,
            "quantity": "12 eggs"
        }
    ]
}

Be precise with calorie estimates based on standard nutritional data. For items like "eggs 12ct", calculate total calories (12 x 70 = 840)."""
    ).with_model("openai", "gpt-5.2")
    
    try:
        if image_base64:
            # Clean base64 string
            if "," in image_base64:
                image_base64 = image_base64.split(",")[1]
            
            image_content = ImageContent(image_base64=image_base64)
            message = UserMessage(
                text="Analyze this grocery receipt image. Extract all food items with prices and estimate calories for each. Return JSON only.",
                file_contents=[image_content]
            )
        else:
            message = UserMessage(
                text=f"Analyze this grocery receipt text. Extract all food items with prices and estimate calories for each. Return JSON only.\n\nReceipt:\n{text}"
            )
        
        response = await chat.send_message(message)
        
        # Parse JSON from response
        import json
        import re
        
        # Try to extract JSON from response
        json_match = re.search(r'\{[\s\S]*\}', response)
        if json_match:
            result = json.loads(json_match.group())
            return result
        else:
            logger.error(f"Could not parse AI response: {response}")
            raise HTTPException(status_code=500, detail="Failed to parse AI response")
            
    except Exception as e:
        logger.error(f"AI analysis error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"AI analysis failed: {str(e)}")

def generate_insights(items: List[FoodItem]) -> dict:
    """Generate insights from analyzed items."""
    if not items:
        return {"best_value": [], "worst_value": [], "insights": []}
    
    sorted_items = sorted(items, key=lambda x: x.calories_per_dollar, reverse=True)
    
    best_value = [item.name for item in sorted_items[:3]]
    worst_value = [item.name for item in sorted_items[-3:]] if len(sorted_items) >= 3 else []
    
    avg_cpd = sum(i.calories_per_dollar for i in items) / len(items)
    
    insights = []
    
    # Top performer insight
    if sorted_items:
        top = sorted_items[0]
        insights.append(f"🏆 Best value: {top.name} at {top.calories_per_dollar:.0f} cal/$")
    
    # Budget efficiency
    high_value_count = sum(1 for i in items if i.calories_per_dollar > avg_cpd)
    insights.append(f"📊 {high_value_count}/{len(items)} items are above average efficiency ({avg_cpd:.0f} cal/$)")
    
    # Suggestions
    if any(i.calories_per_dollar < 100 for i in items):
        low_items = [i.name for i in items if i.calories_per_dollar < 100]
        insights.append(f"💡 Consider alternatives for low-value items: {', '.join(low_items[:2])}")
    
    # Protein vs carbs balance
    protein_keywords = ["egg", "chicken", "beef", "pork", "fish", "turkey", "ham", "bacon"]
    carb_keywords = ["bread", "rice", "pasta", "cereal", "potato"]
    
    protein_items = sum(1 for i in items if any(k in i.name.lower() for k in protein_keywords))
    carb_items = sum(1 for i in items if any(k in i.name.lower() for k in carb_keywords))
    
    if protein_items < carb_items:
        insights.append("🥩 Consider adding more protein sources for balanced nutrition")
    elif carb_items < protein_items:
        insights.append("🍞 Consider adding more whole grains for balanced nutrition")
    
    return {
        "best_value": best_value,
        "worst_value": worst_value,
        "insights": insights
    }

# ==================== AUTH ROUTES ====================

@api_router.post("/auth/register", response_model=TokenResponse)
async def register(data: UserCreate):
    existing = await db.users.find_one({"email": data.email}, {"_id": 0})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    user_id = str(uuid.uuid4())
    user = {
        "id": user_id,
        "email": data.email,
        "name": data.name,
        "password_hash": hash_password(data.password),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.users.insert_one(user)
    token = create_token(user_id)
    
    return TokenResponse(
        access_token=token,
        user=UserResponse(
            id=user_id,
            email=data.email,
            name=data.name,
            created_at=user["created_at"]
        )
    )

@api_router.post("/auth/login", response_model=TokenResponse)
async def login(data: UserLogin):
    user = await db.users.find_one({"email": data.email}, {"_id": 0})
    if not user or not verify_password(data.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    token = create_token(user["id"])
    
    return TokenResponse(
        access_token=token,
        user=UserResponse(
            id=user["id"],
            email=user["email"],
            name=user["name"],
            created_at=user["created_at"]
        )
    )

@api_router.get("/auth/me", response_model=UserResponse)
async def get_me(current_user: dict = Depends(get_current_user)):
    return UserResponse(
        id=current_user["id"],
        email=current_user["email"],
        name=current_user["name"],
        created_at=current_user["created_at"]
    )

# ==================== ANALYSIS ROUTES ====================

@api_router.post("/extract")
async def extract_items(data: ExtractRequest, current_user: dict = Depends(get_current_user)):
    """Extract items from receipt without saving - allows user to edit before final analysis"""
    if not data.receipt_text and not data.receipt_image_base64:
        raise HTTPException(status_code=400, detail="Either receipt_text or receipt_image_base64 is required")
    
    # Analyze with AI
    ai_result = await analyze_receipt_with_ai(
        text=data.receipt_text,
        image_base64=data.receipt_image_base64
    )
    
    # Process items
    extracted_items = []
    for item_data in ai_result.get("items", []):
        price = float(item_data.get("price", 0))
        calories = int(item_data.get("calories", 0))
        
        # Try to enhance with database if AI gave low confidence
        if calories == 0:
            db_estimate = estimate_calories_from_database(item_data.get("name", ""))
            if db_estimate:
                calories = db_estimate["calories"]
        
        if price > 0:
            extracted_items.append({
                "name": item_data.get("name", "Unknown"),
                "calories": calories if calories > 0 else 100,  # Default to 100 if unknown
                "price": price,
                "quantity": item_data.get("quantity")
            })
    
    if not extracted_items:
        raise HTTPException(status_code=400, detail="No valid food items found in receipt")
    
    return {"items": extracted_items}

@api_router.post("/analysis/from-items", response_model=AnalysisResult)
async def create_analysis_from_items(data: AnalysisFromItemsRequest, current_user: dict = Depends(get_current_user)):
    """Create analysis from user-edited items list"""
    if not data.items:
        raise HTTPException(status_code=400, detail="Items list cannot be empty")
    
    # Process items
    food_items = []
    for item_data in data.items:
        price = float(item_data.price)
        calories = int(item_data.calories)
        
        if price > 0 and calories > 0:
            cpd = calories / price
            food_items.append(FoodItem(
                name=item_data.name,
                calories=calories,
                price=price,
                calories_per_dollar=round(cpd, 2),
                quantity=item_data.quantity
            ))
    
    if not food_items:
        raise HTTPException(status_code=400, detail="No valid food items provided")
    
    # Sort by calories per dollar
    food_items.sort(key=lambda x: x.calories_per_dollar, reverse=True)
    
    # Calculate totals
    total_calories = sum(item.calories for item in food_items)
    total_cost = sum(item.price for item in food_items)
    avg_cpd = total_calories / total_cost if total_cost > 0 else 0
    
    # Generate insights
    insights_data = generate_insights(food_items)
    
    # Create analysis record
    analysis_id = str(uuid.uuid4())
    analysis = {
        "id": analysis_id,
        "user_id": current_user["id"],
        "items": [item.model_dump() for item in food_items],
        "total_calories": total_calories,
        "total_cost": round(total_cost, 2),
        "avg_calories_per_dollar": round(avg_cpd, 2),
        "best_value_items": insights_data["best_value"],
        "worst_value_items": insights_data["worst_value"],
        "insights": insights_data["insights"],
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.analyses.insert_one(analysis)
    
    return AnalysisResult(**{k: v for k, v in analysis.items() if k != "_id"})

@api_router.post("/analysis", response_model=AnalysisResult)
async def create_analysis(data: AnalysisRequest, current_user: dict = Depends(get_current_user)):
    if not data.receipt_text and not data.receipt_image_base64:
        raise HTTPException(status_code=400, detail="Either receipt_text or receipt_image_base64 is required")
    
    # Analyze with AI
    ai_result = await analyze_receipt_with_ai(
        text=data.receipt_text,
        image_base64=data.receipt_image_base64
    )
    
    # Process items
    food_items = []
    for item_data in ai_result.get("items", []):
        price = float(item_data.get("price", 0))
        calories = int(item_data.get("calories", 0))
        
        # Try to enhance with database if AI gave low confidence
        if calories == 0:
            db_estimate = estimate_calories_from_database(item_data.get("name", ""))
            if db_estimate:
                calories = db_estimate["calories"]
        
        if price > 0 and calories > 0:
            cpd = calories / price
            food_items.append(FoodItem(
                name=item_data.get("name", "Unknown"),
                calories=calories,
                price=price,
                calories_per_dollar=round(cpd, 2),
                quantity=item_data.get("quantity")
            ))
    
    if not food_items:
        raise HTTPException(status_code=400, detail="No valid food items found in receipt")
    
    # Sort by calories per dollar
    food_items.sort(key=lambda x: x.calories_per_dollar, reverse=True)
    
    # Calculate totals
    total_calories = sum(item.calories for item in food_items)
    total_cost = sum(item.price for item in food_items)
    avg_cpd = total_calories / total_cost if total_cost > 0 else 0
    
    # Generate insights
    insights_data = generate_insights(food_items)
    
    # Create analysis record
    analysis_id = str(uuid.uuid4())
    analysis = {
        "id": analysis_id,
        "user_id": current_user["id"],
        "items": [item.model_dump() for item in food_items],
        "total_calories": total_calories,
        "total_cost": round(total_cost, 2),
        "avg_calories_per_dollar": round(avg_cpd, 2),
        "best_value_items": insights_data["best_value"],
        "worst_value_items": insights_data["worst_value"],
        "insights": insights_data["insights"],
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.analyses.insert_one(analysis)
    
    return AnalysisResult(**{k: v for k, v in analysis.items() if k != "_id"})

@api_router.get("/analysis", response_model=List[AnalysisHistory])
async def get_analysis_history(current_user: dict = Depends(get_current_user)):
    analyses = await db.analyses.find(
        {"user_id": current_user["id"]},
        {"_id": 0, "id": 1, "total_calories": 1, "total_cost": 1, 
         "avg_calories_per_dollar": 1, "items": 1, "created_at": 1}
    ).sort("created_at", -1).to_list(100)
    
    return [
        AnalysisHistory(
            id=a["id"],
            total_calories=a["total_calories"],
            total_cost=a["total_cost"],
            avg_calories_per_dollar=a["avg_calories_per_dollar"],
            item_count=len(a.get("items", [])),
            created_at=a["created_at"]
        )
        for a in analyses
    ]

@api_router.get("/analysis/{analysis_id}", response_model=AnalysisResult)
async def get_analysis(analysis_id: str, current_user: dict = Depends(get_current_user)):
    analysis = await db.analyses.find_one(
        {"id": analysis_id, "user_id": current_user["id"]},
        {"_id": 0}
    )
    
    if not analysis:
        raise HTTPException(status_code=404, detail="Analysis not found")
    
    return AnalysisResult(**analysis)

@api_router.delete("/analysis/{analysis_id}")
async def delete_analysis(analysis_id: str, current_user: dict = Depends(get_current_user)):
    result = await db.analyses.delete_one({"id": analysis_id, "user_id": current_user["id"]})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Analysis not found")
    
    return {"message": "Analysis deleted successfully"}

# ==================== MEAL TRACKING ROUTES ====================

@api_router.post("/meals/log", response_model=MealEntry)
async def log_meal(data: MealEntryCreate, current_user: dict = Depends(get_current_user)):
    """Log a meal entry with gram-based proportional cost calculation"""
    
    # Calculate proportional values based on grams
    # Calories = (grams consumed / 100) × calories per 100g
    calories_consumed = int((data.grams_consumed / 100) * data.calories_per_100g)
    
    # Cost = (grams consumed / total grams) × total price
    proportion = data.grams_consumed / data.total_grams if data.total_grams > 0 else 0
    cost = round(data.total_price * proportion, 2)
    
    entry_id = str(uuid.uuid4())
    entry = {
        "id": entry_id,
        "user_id": current_user["id"],
        "item_name": data.item_name,
        "calories_consumed": calories_consumed,
        "cost": cost,
        "grams_consumed": data.grams_consumed,
        "total_grams": data.total_grams,
        "calories_per_100g": data.calories_per_100g,
        "total_price": data.total_price,
        "source": data.source,
        "source_id": data.source_id,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "date": datetime.now(timezone.utc).strftime("%Y-%m-%d")
    }
    
    await db.meal_logs.insert_one(entry)
    
    return MealEntry(
        id=entry_id,
        item_name=data.item_name,
        calories_consumed=calories_consumed,
        cost=cost,
        grams_consumed=data.grams_consumed,
        total_grams=data.total_grams,
        calories_per_100g=data.calories_per_100g,
        source=data.source,
        timestamp=entry["timestamp"]
    )

@api_router.get("/meals/today", response_model=DailySummary)
async def get_today_meals(current_user: dict = Depends(get_current_user)):
    """Get today's meal log"""
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    return await get_meals_by_date(today, current_user)

@api_router.get("/meals/date/{date}", response_model=DailySummary)
async def get_meals_for_date(date: str, current_user: dict = Depends(get_current_user)):
    """Get meals for a specific date (YYYY-MM-DD)"""
    return await get_meals_by_date(date, current_user)

async def get_meals_by_date(date: str, current_user: dict) -> DailySummary:
    """Helper function to get meals for a date"""
    entries = await db.meal_logs.find(
        {"user_id": current_user["id"], "date": date},
        {"_id": 0}
    ).sort("timestamp", 1).to_list(100)
    
    total_calories = sum(e.get("calories_consumed", 0) for e in entries)
    total_cost = sum(e.get("cost", 0) for e in entries)
    
    meal_entries = [
        MealEntry(
            id=e["id"],
            item_name=e["item_name"],
            calories_consumed=e["calories_consumed"],
            cost=e["cost"],
            grams_consumed=e.get("grams_consumed", e.get("units_consumed", 0) * 100),  # Backwards compat
            total_grams=e.get("total_grams", e.get("total_units", 1) * 100),  # Backwards compat
            calories_per_100g=e.get("calories_per_100g", e.get("calories_per_unit", 0)),  # Backwards compat
            source=e["source"],
            timestamp=e["timestamp"]
        )
        for e in entries
    ]
    
    return DailySummary(
        date=date,
        total_calories=total_calories,
        total_cost=round(total_cost, 2),
        meal_count=len(entries),
        entries=meal_entries
    )

@api_router.get("/meals/calendar")
async def get_calendar_data(
    month: int,
    year: int,
    current_user: dict = Depends(get_current_user)
):
    """Get monthly calendar data with daily summaries"""
    # Build date range for the month
    start_date = f"{year}-{month:02d}-01"
    if month == 12:
        end_date = f"{year + 1}-01-01"
    else:
        end_date = f"{year}-{month + 1:02d}-01"
    
    # Aggregate daily totals
    pipeline = [
        {
            "$match": {
                "user_id": current_user["id"],
                "date": {"$gte": start_date, "$lt": end_date}
            }
        },
        {
            "$group": {
                "_id": "$date",
                "total_calories": {"$sum": "$calories_consumed"},
                "total_cost": {"$sum": "$cost"},
                "meal_count": {"$sum": 1}
            }
        },
        {"$sort": {"_id": 1}}
    ]
    
    results = await db.meal_logs.aggregate(pipeline).to_list(31)
    
    days = [
        CalendarDay(
            date=r["_id"],
            total_calories=r["total_calories"],
            total_cost=round(r["total_cost"], 2),
            meal_count=r["meal_count"]
        )
        for r in results
    ]
    
    # Calculate monthly totals
    monthly_calories = sum(d.total_calories for d in days)
    monthly_cost = sum(d.total_cost for d in days)
    
    return {
        "month": month,
        "year": year,
        "days": days,
        "monthly_totals": {
            "total_calories": monthly_calories,
            "total_cost": round(monthly_cost, 2),
            "days_logged": len(days)
        }
    }

@api_router.delete("/meals/{entry_id}")
async def delete_meal_entry(entry_id: str, current_user: dict = Depends(get_current_user)):
    """Delete a meal entry"""
    result = await db.meal_logs.delete_one({"id": entry_id, "user_id": current_user["id"]})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Meal entry not found")
    
    return {"message": "Meal entry deleted successfully"}

@api_router.get("/meals/receipt-items/{analysis_id}")
async def get_receipt_items_for_tracking(analysis_id: str, current_user: dict = Depends(get_current_user)):
    """Get items from a receipt analysis for meal tracking - returns gram-based data"""
    analysis = await db.analyses.find_one(
        {"id": analysis_id, "user_id": current_user["id"]},
        {"_id": 0, "items": 1, "created_at": 1}
    )
    
    if not analysis:
        raise HTTPException(status_code=404, detail="Analysis not found")
    
    # Estimate grams and calories per 100g from item data
    tracking_items = []
    for item in analysis.get("items", []):
        quantity_str = item.get("quantity", "").lower()
        
        # Estimate total grams based on common patterns
        total_grams = 100.0  # Default
        
        import re
        
        # Check for weight patterns
        kg_match = re.search(r'(\d+(?:\.\d+)?)\s*kg', quantity_str)
        lb_match = re.search(r'(\d+(?:\.\d+)?)\s*lb', quantity_str)
        g_match = re.search(r'(\d+(?:\.\d+)?)\s*g(?:ram)?', quantity_str)
        oz_match = re.search(r'(\d+(?:\.\d+)?)\s*oz', quantity_str)
        
        if kg_match:
            total_grams = float(kg_match.group(1)) * 1000
        elif lb_match:
            total_grams = float(lb_match.group(1)) * 454
        elif g_match:
            total_grams = float(g_match.group(1))
        elif oz_match:
            total_grams = float(oz_match.group(1)) * 28.35
        elif 'gallon' in quantity_str:
            total_grams = 3785  # 1 gallon of milk
        elif 'dozen' in quantity_str or '12' in quantity_str:
            if 'egg' in item.get("name", "").lower():
                total_grams = 720  # 12 eggs × 60g
        else:
            # Estimate based on calories (rough approximation)
            total_grams = max(100, item["calories"] / 2)  # Assume ~200 cal/100g average
        
        # Calculate calories per 100g from total
        calories_per_100g = int((item["calories"] / total_grams) * 100) if total_grams > 0 else 100
        
        tracking_items.append({
            "name": item["name"],
            "total_calories": item["calories"],
            "total_price": item["price"],
            "total_grams": round(total_grams),
            "calories_per_100g": calories_per_100g,
            "quantity": quantity_str or f"~{round(total_grams)}g"
        })
    
    return {
        "analysis_id": analysis_id,
        "created_at": analysis["created_at"],
        "items": tracking_items
    }

# ==================== ROOT ====================

@api_router.get("/")
async def root():
    return {"message": "Nutrition Cost Analyzer API", "version": "1.0.0"}

@api_router.get("/health")
async def health_check():
    return {"status": "healthy"}

@api_router.get("/food-database")
async def get_food_database(q: str = ""):
    """Search the calorie database for food items - returns calories per 100g"""
    results = []
    search_term = q.lower().strip()
    
    # Standard calorie densities per 100g for common foods
    CALORIE_PER_100G = {
        "eggs": 155,
        "milk": 42,
        "cheese": 402,
        "butter": 717,
        "yogurt": 59,
        "cream cheese": 342,
        "bread": 265,
        "rice": 130,
        "pasta": 131,
        "oatmeal": 68,
        "cereal": 379,
        "tortilla": 218,
        "bagel": 257,
        "chicken": 165,
        "beef": 250,
        "pork": 242,
        "ground beef": 254,
        "bacon": 541,
        "sausage": 301,
        "turkey": 135,
        "ham": 145,
        "fish": 206,
        "salmon": 208,
        "tuna": 132,
        "apple": 52,
        "banana": 89,
        "orange": 47,
        "grapes": 69,
        "strawberries": 32,
        "blueberries": 57,
        "potato": 77,
        "tomato": 18,
        "lettuce": 15,
        "carrot": 41,
        "broccoli": 34,
        "onion": 40,
        "spinach": 23,
        "beans": 127,
        "soup": 30,
        "peanut butter": 588,
        "juice": 45,
        "soda": 41,
        "coffee": 1,
        "chips": 536,
        "cookies": 488,
        "crackers": 421,
        "nuts": 607,
        "almonds": 579,
    }
    
    for name, cal_per_100g in CALORIE_PER_100G.items():
        if not search_term or search_term in name:
            # Estimate typical package size in grams
            typical_grams = CALORIE_DATABASE.get(name, {}).get("typical_quantity", 1) * 100
            if name in ["eggs"]:
                typical_grams = 720  # 12 eggs × 60g each
            elif name in ["milk"]:
                typical_grams = 3785  # 1 gallon
            elif name in ["bread"]:
                typical_grams = 500  # typical loaf
            elif name in ["rice", "pasta"]:
                typical_grams = 907  # 2 lb bag
            elif name in ["chicken", "beef", "pork", "ground beef"]:
                typical_grams = 454  # 1 lb
            
            results.append({
                "name": name.title(),
                "calories_per_100g": cal_per_100g,
                "typical_grams": typical_grams,
                "typical_serving_grams": 100,  # Default serving size
            })
    
    # Sort by relevance (exact match first, then alphabetical)
    results.sort(key=lambda x: (0 if x["name"].lower() == search_term else 1, x["name"]))
    
    return {"items": results[:15]}  # Limit to 15 results

# Include router and middleware
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
