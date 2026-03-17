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

class ServingSize(BaseModel):
    description: str  # e.g., "1 large", "1 cup", "1 slice"
    grams: float

class FoodNutrients(BaseModel):
    calories: float
    protein: float
    carbs: float
    fat: float
    fiber: float
    sugar: float

class USDAFoodItem(BaseModel):
    fdc_id: int
    name: str
    nutrients_per_100g: FoodNutrients
    serving_sizes: List[ServingSize]

class MealEntryCreate(BaseModel):
    item_name: str
    fdc_id: Optional[int] = None
    # Nutrients per 100g
    calories_per_100g: float
    protein_per_100g: float
    carbs_per_100g: float
    fat_per_100g: float
    fiber_per_100g: float = 0
    sugar_per_100g: float = 0
    # Serving info
    serving_description: str  # e.g., "2 large eggs"
    serving_grams: float
    # Cost calculation
    total_grams_purchased: float
    total_price: float
    # Meal type
    meal_type: Optional[str] = None  # breakfast, lunch, dinner, snack, or None
    source: str = "usda"  # usda, receipt, manual

class MealEntry(BaseModel):
    id: str
    item_name: str
    # Consumed nutrients
    calories: int
    protein: float
    carbs: float
    fat: float
    fiber: float
    sugar: float
    # Serving info
    serving_description: str
    serving_grams: float
    cost: float
    meal_type: Optional[str]
    source: str
    timestamp: str

class DailySummary(BaseModel):
    date: str
    total_calories: int
    total_protein: float
    total_carbs: float
    total_fat: float
    total_fiber: float
    total_sugar: float
    total_cost: float
    meal_count: int
    entries: List[MealEntry]
    entries_by_meal: Optional[dict] = None

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
    """Log a meal entry with full macros and proportional cost calculation"""
    
    # Calculate proportional values based on serving grams
    multiplier = data.serving_grams / 100
    
    calories = int(data.calories_per_100g * multiplier)
    protein = round(data.protein_per_100g * multiplier, 1)
    carbs = round(data.carbs_per_100g * multiplier, 1)
    fat = round(data.fat_per_100g * multiplier, 1)
    fiber = round(data.fiber_per_100g * multiplier, 1)
    sugar = round(data.sugar_per_100g * multiplier, 1)
    
    # Cost = (serving grams / total grams purchased) × total price
    proportion = data.serving_grams / data.total_grams_purchased if data.total_grams_purchased > 0 else 0
    cost = round(data.total_price * proportion, 2)
    
    entry_id = str(uuid.uuid4())
    entry = {
        "id": entry_id,
        "user_id": current_user["id"],
        "item_name": data.item_name,
        "fdc_id": data.fdc_id,
        # Consumed values
        "calories": calories,
        "protein": protein,
        "carbs": carbs,
        "fat": fat,
        "fiber": fiber,
        "sugar": sugar,
        "cost": cost,
        # Per 100g values (for reference)
        "calories_per_100g": data.calories_per_100g,
        "protein_per_100g": data.protein_per_100g,
        "carbs_per_100g": data.carbs_per_100g,
        "fat_per_100g": data.fat_per_100g,
        "fiber_per_100g": data.fiber_per_100g,
        "sugar_per_100g": data.sugar_per_100g,
        # Serving info
        "serving_description": data.serving_description,
        "serving_grams": data.serving_grams,
        "total_grams_purchased": data.total_grams_purchased,
        "total_price": data.total_price,
        # Metadata
        "meal_type": data.meal_type,
        "source": data.source,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "date": datetime.now(timezone.utc).strftime("%Y-%m-%d")
    }
    
    await db.meal_logs.insert_one(entry)
    
    return MealEntry(
        id=entry_id,
        item_name=data.item_name,
        calories=calories,
        protein=protein,
        carbs=carbs,
        fat=fat,
        fiber=fiber,
        sugar=sugar,
        serving_description=data.serving_description,
        serving_grams=data.serving_grams,
        cost=cost,
        meal_type=data.meal_type,
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
    """Helper function to get meals for a date with full macro breakdown"""
    entries = await db.meal_logs.find(
        {"user_id": current_user["id"], "date": date},
        {"_id": 0}
    ).sort("timestamp", 1).to_list(100)
    
    # Calculate totals
    total_calories = sum(e.get("calories", e.get("calories_consumed", 0)) for e in entries)
    total_protein = sum(e.get("protein", 0) for e in entries)
    total_carbs = sum(e.get("carbs", 0) for e in entries)
    total_fat = sum(e.get("fat", 0) for e in entries)
    total_fiber = sum(e.get("fiber", 0) for e in entries)
    total_sugar = sum(e.get("sugar", 0) for e in entries)
    total_cost = sum(e.get("cost", 0) for e in entries)
    
    meal_entries = []
    for e in entries:
        meal_entries.append(MealEntry(
            id=e["id"],
            item_name=e["item_name"],
            calories=e.get("calories", e.get("calories_consumed", 0)),
            protein=e.get("protein", 0),
            carbs=e.get("carbs", 0),
            fat=e.get("fat", 0),
            fiber=e.get("fiber", 0),
            sugar=e.get("sugar", 0),
            serving_description=e.get("serving_description", f"{e.get('grams_consumed', 100)}g"),
            serving_grams=e.get("serving_grams", e.get("grams_consumed", 100)),
            cost=e.get("cost", 0),
            meal_type=e.get("meal_type"),
            source=e.get("source", "manual"),
            timestamp=e["timestamp"]
        ))
    
    # Group entries by meal type for dual view
    entries_by_meal = {"breakfast": [], "lunch": [], "dinner": [], "snack": [], "other": []}
    for entry in meal_entries:
        meal_type = entry.meal_type or "other"
        if meal_type in entries_by_meal:
            entries_by_meal[meal_type].append(entry.model_dump())
        else:
            entries_by_meal["other"].append(entry.model_dump())
    
    return DailySummary(
        date=date,
        total_calories=total_calories,
        total_protein=round(total_protein, 1),
        total_carbs=round(total_carbs, 1),
        total_fat=round(total_fat, 1),
        total_fiber=round(total_fiber, 1),
        total_sugar=round(total_sugar, 1),
        total_cost=round(total_cost, 2),
        meal_count=len(entries),
        entries=meal_entries,
        entries_by_meal=entries_by_meal
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
        quantity_str = (item.get("quantity") or "").lower()
        
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
            if 'egg' in (item.get("name") or "").lower():
                total_grams = 720  # 12 eggs × 60g
        else:
            # Estimate based on calories (rough approximation)
            total_grams = max(100, item.get("calories", 100) / 2)  # Assume ~200 cal/100g average
        
        # Calculate calories per 100g from total
        item_calories = item.get("calories", 100)
        calories_per_100g = int((item_calories / total_grams) * 100) if total_grams > 0 else 100
        
        tracking_items.append({
            "name": item.get("name", "Unknown"),
            "total_calories": item_calories,
            "total_price": item.get("price", 0),
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

# ==================== USDA FOOD DATABASE ====================

import httpx

USDA_API_KEY = os.environ.get('USDA_API_KEY', '')
USDA_BASE_URL = "https://api.nal.usda.gov/fdc/v1"

@api_router.get("/food-search")
async def search_usda_foods(q: str, limit: int = 15):
    """Search USDA FoodData Central for foods with full nutrition and serving sizes"""
    if not q or len(q) < 2:
        return {"items": []}
    
    if not USDA_API_KEY:
        raise HTTPException(status_code=500, detail="USDA API key not configured")
    
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            # Search for foods - prefer SR Legacy and Foundation for better portion data
            response = await client.post(
                f"{USDA_BASE_URL}/foods/search",
                params={"api_key": USDA_API_KEY},
                json={
                    "query": q,
                    "pageSize": limit,
                    "dataType": ["SR Legacy", "Foundation", "Survey (FNDDS)"]
                }
            )
            response.raise_for_status()
            data = response.json()
            
            results = []
            for food in data.get("foods", []):
                # Extract nutrients
                nutrients = {}
                for n in food.get("foodNutrients", []):
                    name = n.get("nutrientName", "")
                    value = n.get("value", 0)
                    if "Energy" in name and "KCAL" in n.get("unitName", "").upper():
                        nutrients["calories"] = value
                    elif name == "Protein":
                        nutrients["protein"] = value
                    elif "Carbohydrate" in name:
                        nutrients["carbs"] = value
                    elif "Total lipid" in name or name == "Fat":
                        nutrients["fat"] = value
                    elif "Fiber" in name:
                        nutrients["fiber"] = value
                    elif "Sugar" in name and "Total" in name:
                        nutrients["sugar"] = value
                
                # Only include if we have basic nutrients
                if nutrients.get("calories"):
                    results.append({
                        "fdc_id": food.get("fdcId"),
                        "name": food.get("description", "").title(),
                        "data_type": food.get("dataType"),
                        "nutrients_per_100g": {
                            "calories": nutrients.get("calories", 0),
                            "protein": round(nutrients.get("protein", 0), 1),
                            "carbs": round(nutrients.get("carbs", 0), 1),
                            "fat": round(nutrients.get("fat", 0), 1),
                            "fiber": round(nutrients.get("fiber", 0), 1),
                            "sugar": round(nutrients.get("sugar", 0), 1)
                        }
                    })
            
            return {"items": results}
            
    except httpx.TimeoutException:
        raise HTTPException(status_code=504, detail="USDA API timeout")
    except Exception as e:
        logger.error(f"USDA search error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"USDA search failed: {str(e)}")

@api_router.get("/food/{fdc_id}")
async def get_food_details(fdc_id: int):
    """Get detailed food info including serving sizes from USDA"""
    if not USDA_API_KEY:
        raise HTTPException(status_code=500, detail="USDA API key not configured")
    
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(
                f"{USDA_BASE_URL}/food/{fdc_id}",
                params={"api_key": USDA_API_KEY}
            )
            response.raise_for_status()
            food = response.json()
            
            # Extract nutrients per 100g
            nutrients = {
                "calories": 0, "protein": 0, "carbs": 0,
                "fat": 0, "fiber": 0, "sugar": 0
            }
            
            for n in food.get("foodNutrients", []):
                nutrient = n.get("nutrient", {})
                name = nutrient.get("name", "")
                amount = n.get("amount", 0)
                
                if name == "Energy" and nutrient.get("unitName") == "kcal":
                    nutrients["calories"] = amount
                elif name == "Protein":
                    nutrients["protein"] = round(amount, 1)
                elif "Carbohydrate" in name:
                    nutrients["carbs"] = round(amount, 1)
                elif "Total lipid" in name:
                    nutrients["fat"] = round(amount, 1)
                elif "Fiber" in name:
                    nutrients["fiber"] = round(amount, 1)
                elif "Sugars, total" in name:
                    nutrients["sugar"] = round(amount, 1)
            
            # Extract serving sizes
            serving_sizes = []
            for portion in food.get("foodPortions", []):
                desc = portion.get("portionDescription") or portion.get("modifier") or "serving"
                grams = portion.get("gramWeight", 100)
                if grams and grams > 0:
                    serving_sizes.append({
                        "description": desc,
                        "grams": round(grams, 1)
                    })
            
            # Add custom gram option if no portions
            if not serving_sizes:
                serving_sizes.append({"description": "100g", "grams": 100})
            
            return {
                "fdc_id": fdc_id,
                "name": food.get("description", "").title(),
                "nutrients_per_100g": nutrients,
                "serving_sizes": serving_sizes
            }
            
    except httpx.TimeoutException:
        raise HTTPException(status_code=504, detail="USDA API timeout")
    except Exception as e:
        logger.error(f"USDA food details error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to get food details: {str(e)}")

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
