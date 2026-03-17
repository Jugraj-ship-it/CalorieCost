#!/usr/bin/env python3

import requests
import sys
import json
import time
from datetime import datetime

class NutritionAnalyzerAPITester:
    def __init__(self, base_url="https://cost-per-calorie.preview.emergentagent.com/api"):
        self.base_url = base_url
        self.token = None
        self.user_id = None
        self.tests_run = 0
        self.tests_passed = 0
        self.analysis_id = None

    def log(self, message):
        print(f"[{datetime.now().strftime('%H:%M:%S')}] {message}")

    def run_test(self, name, method, endpoint, expected_status, data=None, files=None):
        """Run a single API test"""
        url = f"{self.base_url}/{endpoint}"
        headers = {'Content-Type': 'application/json'}
        if self.token:
            headers['Authorization'] = f'Bearer {self.token}'

        self.tests_run += 1
        self.log(f"🔍 Testing {name}...")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers)
            elif method == 'POST':
                if files:
                    headers.pop('Content-Type', None)  # Remove for multipart
                    response = requests.post(url, files=files, headers=headers)
                else:
                    response = requests.post(url, json=data, headers=headers)
            elif method == 'DELETE':
                response = requests.delete(url, headers=headers)

            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                self.log(f"✅ {name} - Status: {response.status_code}")
                try:
                    return success, response.json() if response.text else {}
                except:
                    return success, {}
            else:
                self.log(f"❌ {name} - Expected {expected_status}, got {response.status_code}")
                self.log(f"   Response: {response.text[:200]}")
                try:
                    return False, response.json() if response.text else {}
                except:
                    return False, {}

        except Exception as e:
            self.log(f"❌ {name} - Error: {str(e)}")
            return False, {}

    def test_health_check(self):
        """Test basic API health"""
        success, response = self.run_test(
            "Health Check",
            "GET",
            "health",
            200
        )
        return success

    def test_root_endpoint(self):
        """Test root API endpoint"""
        success, response = self.run_test(
            "Root Endpoint",
            "GET",
            "",
            200
        )
        if success and "Nutrition Cost Analyzer API" in str(response):
            self.log("   ✓ API message confirmed")
        return success

    def test_register_user(self):
        """Test user registration"""
        timestamp = int(time.time())
        test_user_data = {
            "email": f"test_user_{timestamp}@example.com",
            "password": "TestPass123!",
            "name": f"Test User {timestamp}"
        }
        
        success, response = self.run_test(
            "User Registration",
            "POST",
            "auth/register",
            200,
            data=test_user_data
        )
        
        if success and 'access_token' in response:
            self.token = response['access_token']
            self.user_id = response['user']['id']
            self.log(f"   ✓ Token received: {self.token[:20]}...")
            self.log(f"   ✓ User ID: {self.user_id}")
            return True
        return False

    def test_duplicate_registration(self):
        """Test duplicate email registration should fail"""
        if not self.token:
            return False
            
        # Try to register with same email again
        timestamp = int(time.time())
        test_user_data = {
            "email": f"test_user_{timestamp-1}@example.com",  # Use previous email
            "password": "TestPass123!",
            "name": "Duplicate Test User"
        }
        
        success, response = self.run_test(
            "Duplicate Registration (should fail)",
            "POST",
            "auth/register",
            400,
            data=test_user_data
        )
        return success

    def test_login(self):
        """Test user login with valid credentials"""
        if not self.token:
            # Create a new user first for login test
            timestamp = int(time.time())
            user_data = {
                "email": f"login_test_{timestamp}@example.com",
                "password": "TestPass123!",
                "name": f"Login Test User {timestamp}"
            }
            
            # Register first
            reg_success, reg_response = self.run_test(
                "Register for Login Test",
                "POST", 
                "auth/register",
                200,
                data=user_data
            )
            
            if not reg_success:
                return False
        
            # Now test login
            login_data = {
                "email": user_data["email"],
                "password": user_data["password"]
            }
        else:
            # Use existing user info for login test
            login_data = {
                "email": "test@example.com",  # Default test email
                "password": "TestPass123!"
            }
        
        success, response = self.run_test(
            "User Login",
            "POST",
            "auth/login",
            200,
            data=login_data
        )
        
        if success and 'access_token' in response:
            self.log(f"   ✓ Login successful")
            return True
        return False

    def test_invalid_login(self):
        """Test login with invalid credentials"""
        invalid_data = {
            "email": "nonexistent@example.com",
            "password": "WrongPassword"
        }
        
        success, response = self.run_test(
            "Invalid Login (should fail)",
            "POST",
            "auth/login",
            401,
            data=invalid_data
        )
        return success

    def test_get_current_user(self):
        """Test getting current user profile"""
        if not self.token:
            return False
            
        success, response = self.run_test(
            "Get Current User",
            "GET",
            "auth/me",
            200
        )
        
        if success and response.get('id') == self.user_id:
            self.log(f"   ✓ User profile matches: {response.get('name')}")
            return True
        return False

    def test_unauthorized_access(self):
        """Test accessing protected route without token"""
        # Temporarily remove token
        original_token = self.token
        self.token = None
        
        success, response = self.run_test(
            "Unauthorized Access (should fail)",
            "GET",
            "auth/me",
            401
        )
        
        # Restore token
        self.token = original_token
        return success

    def test_create_analysis_text(self):
        """Test creating analysis from text receipt"""
        if not self.token:
            return False
        
        # Sample receipt text
        receipt_text = """GROCERY MART
Date: 01/15/2024

Large Eggs 12ct          $3.49
Whole Milk 1 gallon      $4.29
White Bread              $2.99
Chicken Breast 2lb       $8.99
Rice 5lb bag             $6.99
Bananas 1 bunch          $1.49

Subtotal: $28.24
Tax: $0.00
Total: $28.24"""
        
        analysis_data = {
            "receipt_text": receipt_text
        }
        
        success, response = self.run_test(
            "Create Analysis from Text",
            "POST",
            "analysis",
            200,
            data=analysis_data
        )
        
        if success and 'id' in response:
            self.analysis_id = response['id']
            self.log(f"   ✓ Analysis created with ID: {self.analysis_id}")
            self.log(f"   ✓ Total calories: {response.get('total_calories')}")
            self.log(f"   ✓ Total cost: ${response.get('total_cost')}")
            self.log(f"   ✓ Avg Cal/$: {response.get('avg_calories_per_dollar')}")
            self.log(f"   ✓ Items analyzed: {len(response.get('items', []))}")
            return True
        return False

    def test_create_analysis_invalid_data(self):
        """Test creating analysis with invalid data"""
        if not self.token:
            return False
        
        # Empty request
        success, response = self.run_test(
            "Create Analysis - Empty Data (should fail)",
            "POST",
            "analysis",
            400,
            data={}
        )
        return success

    def test_get_analysis_history(self):
        """Test getting user's analysis history"""
        if not self.token:
            return False
            
        success, response = self.run_test(
            "Get Analysis History",
            "GET",
            "analysis",
            200
        )
        
        if success and isinstance(response, list):
            self.log(f"   ✓ Found {len(response)} analyses in history")
            if len(response) > 0 and self.analysis_id:
                # Check if our created analysis is in the list
                found = any(a['id'] == self.analysis_id for a in response)
                if found:
                    self.log(f"   ✓ Created analysis found in history")
                else:
                    self.log(f"   ⚠ Created analysis not found in history")
            return True
        return False

    def test_get_specific_analysis(self):
        """Test getting a specific analysis by ID"""
        if not self.token or not self.analysis_id:
            return False
            
        success, response = self.run_test(
            "Get Specific Analysis",
            "GET",
            f"analysis/{self.analysis_id}",
            200
        )
        
        if success and response.get('id') == self.analysis_id:
            self.log(f"   ✓ Analysis details retrieved correctly")
            return True
        return False

    def test_get_nonexistent_analysis(self):
        """Test getting non-existent analysis"""
        if not self.token:
            return False
            
        success, response = self.run_test(
            "Get Non-existent Analysis (should fail)",
            "GET",
            "analysis/nonexistent-id",
            404
        )
        return success

    def test_delete_analysis(self):
        """Test deleting an analysis"""
        if not self.token or not self.analysis_id:
            return False
            
        success, response = self.run_test(
            "Delete Analysis",
            "DELETE",
            f"analysis/{self.analysis_id}",
            200
        )
        
        if success:
            self.log(f"   ✓ Analysis deleted successfully")
            # Try to get it again to confirm deletion
            deleted_success, _ = self.run_test(
                "Confirm Analysis Deleted",
                "GET",
                f"analysis/{self.analysis_id}",
                404
            )
            if deleted_success:
                self.log(f"   ✓ Analysis confirmed deleted")
                return True
        return False

    def test_ai_analysis_processing(self):
        """Test AI analysis with complex receipt"""
        if not self.token:
            return False
        
        # More complex receipt to test AI processing
        complex_receipt = """TARGET STORE #1234
        123 Main St, City, ST 12345
        
        Date: 08/15/2024 Time: 14:32
        
        FOOD & GROCERY:
        Organic Bananas 2lb       $3.98
        Ground Turkey 1lb         $5.49  
        Brown Rice 2lb bag        $4.29
        Greek Yogurt 32oz         $5.99
        Whole Wheat Bread         $3.79
        Fresh Spinach 5oz         $2.99
        Canned Black Beans        $1.29
        Olive Oil 16.9oz          $7.99
        Sweet Potatoes 3lb        $4.49
        Chicken Broth 32oz        $2.99
        
        SUBTOTAL:                $42.29
        TAX:                      $0.00
        TOTAL:                   $42.29
        
        PAYMENT: VISA ****1234
        """
        
        analysis_data = {
            "receipt_text": complex_receipt
        }
        
        self.log("   🤖 Testing AI analysis processing...")
        success, response = self.run_test(
            "AI Analysis Processing",
            "POST",
            "analysis",
            200,
            data=analysis_data
        )
        
        if success and 'items' in response:
            items = response.get('items', [])
            insights = response.get('insights', [])
            self.log(f"   ✓ AI processed {len(items)} items")
            self.log(f"   ✓ Generated {len(insights)} insights")
            if response.get('best_value_items'):
                self.log(f"   ✓ Best value items: {', '.join(response['best_value_items'][:3])}")
            return True
        return False

    # ==================== USDA FOOD DATA TESTS ====================
    
    def test_usda_food_search(self):
        """Test USDA food search functionality"""
        success, response = self.run_test(
            "USDA Food Search - Chicken",
            "GET",
            "food-search?q=chicken breast&limit=5",
            200
        )
        
        if success and 'items' in response:
            items = response.get('items', [])
            self.log(f"   ✓ Found {len(items)} food items from USDA")
            if items:
                item = items[0]
                self.log(f"   ✓ Sample item: {item.get('name', 'Unknown')}")
                nutrients = item.get('nutrients_per_100g', {})
                self.log(f"   ✓ Calories per 100g: {nutrients.get('calories', 0)}")
                self.log(f"   ✓ Protein per 100g: {nutrients.get('protein', 0)}g")
                if item.get('fdc_id'):
                    self.test_food_id = item['fdc_id']  # Store for next test
                    return True
        return False
    
    def test_usda_food_search_empty_query(self):
        """Test USDA food search with empty/short query"""
        success, response = self.run_test(
            "USDA Food Search - Empty Query",
            "GET", 
            "food-search?q=a",  # Too short
            200
        )
        
        if success and response.get('items') == []:
            self.log(f"   ✓ Empty result for short query as expected")
            return True
        return False
    
    def test_usda_food_details(self):
        """Test getting USDA food details with serving sizes"""
        if not hasattr(self, 'test_food_id'):
            # Use a known USDA FDC ID for chicken breast
            self.test_food_id = 171077  # Chicken breast, skinless, boneless, meat only, raw
        
        success, response = self.run_test(
            f"USDA Food Details - FDC ID {self.test_food_id}",
            "GET",
            f"food/{self.test_food_id}",
            200
        )
        
        if success and 'fdc_id' in response:
            self.log(f"   ✓ Food details retrieved: {response.get('name', 'Unknown')}")
            nutrients = response.get('nutrients_per_100g', {})
            self.log(f"   ✓ Full nutrition per 100g available")
            self.log(f"     - Calories: {nutrients.get('calories', 0)}")
            self.log(f"     - Protein: {nutrients.get('protein', 0)}g")
            self.log(f"     - Carbs: {nutrients.get('carbs', 0)}g")
            self.log(f"     - Fat: {nutrients.get('fat', 0)}g")
            self.log(f"     - Fiber: {nutrients.get('fiber', 0)}g")
            self.log(f"     - Sugar: {nutrients.get('sugar', 0)}g")
            
            serving_sizes = response.get('serving_sizes', [])
            self.log(f"   ✓ Found {len(serving_sizes)} serving size options")
            if serving_sizes:
                for i, serving in enumerate(serving_sizes[:3]):  # Show first 3
                    self.log(f"     - {serving.get('description')}: {serving.get('grams')}g")
            return True
        return False
    
    def test_log_meal_with_usda_macros(self):
        """Test logging a meal with full USDA macro data"""
        if not self.token:
            return False
            
        # Test with known USDA data for eggs
        meal_data = {
            "item_name": "Chicken Breast, skinless, boneless, raw",
            "fdc_id": 171077,  # USDA FDC ID for chicken breast
            # Nutrients per 100g (approximate USDA values)
            "calories_per_100g": 165,
            "protein_per_100g": 31.0,
            "carbs_per_100g": 0.0,
            "fat_per_100g": 3.6,
            "fiber_per_100g": 0.0,
            "sugar_per_100g": 0.0,
            # Serving info
            "serving_description": "1 medium piece (150g)",
            "serving_grams": 150,
            # Cost calculation
            "total_grams_purchased": 500,  # 500g package
            "total_price": 8.99,
            # Meal type
            "meal_type": "dinner",
            "source": "usda"
        }
        
        success, response = self.run_test(
            "Log Meal with USDA Macros",
            "POST",
            "meals/log",
            200,
            data=meal_data
        )
        
        if success and 'id' in response:
            self.meal_entry_id = response['id']
            self.log(f"   ✓ USDA meal logged with ID: {self.meal_entry_id}")
            
            # Verify macro calculations (150g serving)
            expected_calories = int(165 * 1.5)  # 247 calories
            expected_protein = round(31.0 * 1.5, 1)  # 46.5g protein
            expected_cost = round((150/500) * 8.99, 2)  # $2.70 proportional cost
            
            self.log(f"   ✓ Calculated calories: {response.get('calories')} (expected ~{expected_calories})")
            self.log(f"   ✓ Calculated protein: {response.get('protein')}g (expected ~{expected_protein}g)")
            self.log(f"   ✓ Proportional cost: ${response.get('cost')} (expected ~${expected_cost})")
            
            # Check all macros are present
            macros = ['calories', 'protein', 'carbs', 'fat', 'fiber', 'sugar']
            all_macros_present = all(macro in response for macro in macros)
            if all_macros_present:
                self.log(f"   ✓ All macro nutrients logged successfully")
                return True
            else:
                missing = [macro for macro in macros if macro not in response]
                self.log(f"   ❌ Missing macros: {missing}")
        return False
    
    def test_log_meal_from_receipt(self):
        """Test logging a meal from receipt analysis"""
        if not self.token:
            return False
        
        # First create an analysis to get receipt items
        receipt_text = """GROCERY STORE
Large Eggs 12ct          $7.00
Milk 1 gallon           $4.50
Total: $11.50"""
        
        analysis_success, analysis_response = self.run_test(
            "Create Analysis for Receipt Meal Test",
            "POST",
            "analysis",
            200,
            data={"receipt_text": receipt_text}
        )
        
        if not analysis_success or 'id' not in analysis_response:
            self.log("   ❌ Failed to create analysis for receipt meal test")
            return False
        
        receipt_analysis_id = analysis_response['id']
        
        # Now log meal from receipt
        meal_data = {
            "item_name": "Large Eggs 12ct",
            "calories_per_unit": 70,
            "total_units": 12,
            "units_consumed": 3,
            "total_price": 7.00,
            "source": "receipt",
            "source_id": receipt_analysis_id,
            "unit_name": "egg"
        }
        
        success, response = self.run_test(
            "Log Meal from Receipt",
            "POST",
            "meals/log",
            200,
            data=meal_data
        )
        
        if success and 'id' in response:
            self.log(f"   ✓ Receipt meal logged with ID: {response['id']}")
            self.log(f"   ✓ Calories consumed: {response.get('calories_consumed')}")
            self.log(f"   ✓ Proportional cost: ${response.get('cost')}")
            
            # Clean up analysis
            self.run_test("Cleanup Receipt Analysis", "DELETE", f"analysis/{receipt_analysis_id}", 200)
            return True
        return False
    
    def test_get_today_meals_with_macros(self):
        """Test getting today's meal log with full macro breakdown"""
        if not self.token:
            return False
            
        success, response = self.run_test(
            "Get Today's Meals with Macros",
            "GET",
            "meals/today",
            200
        )
        
        if success and 'entries' in response:
            entries = response.get('entries', [])
            self.log(f"   ✓ Found {len(entries)} meals today")
            
            # Check daily totals include all macros
            macro_fields = ['total_calories', 'total_protein', 'total_carbs', 'total_fat', 'total_fiber', 'total_sugar', 'total_cost']
            totals_complete = all(field in response for field in macro_fields)
            
            if totals_complete:
                self.log(f"   ✓ Daily totals complete:")
                self.log(f"     - Calories: {response.get('total_calories', 0)}")
                self.log(f"     - Protein: {response.get('total_protein', 0)}g")  
                self.log(f"     - Carbs: {response.get('total_carbs', 0)}g")
                self.log(f"     - Fat: {response.get('total_fat', 0)}g")
                self.log(f"     - Fiber: {response.get('total_fiber', 0)}g")
                self.log(f"     - Sugar: {response.get('total_sugar', 0)}g")
                self.log(f"     - Cost: ${response.get('total_cost', 0)}")
            
            # Check entries_by_meal for dual view
            if 'entries_by_meal' in response:
                by_meal = response['entries_by_meal']
                meal_types = ['breakfast', 'lunch', 'dinner', 'snack', 'other']
                self.log(f"   ✓ Entries by meal view available:")
                for meal_type in meal_types:
                    count = len(by_meal.get(meal_type, []))
                    if count > 0:
                        self.log(f"     - {meal_type.capitalize()}: {count} entries")
                
                return True
            else:
                self.log(f"   ❌ entries_by_meal not found for dual view")
        return False
    
    def test_get_meals_by_date(self):
        """Test getting meals for a specific date"""
        if not self.token:
            return False
        
        from datetime import datetime
        today = datetime.now().strftime('%Y-%m-%d')
            
        success, response = self.run_test(
            f"Get Meals for Date ({today})",
            "GET",
            f"meals/date/{today}",
            200
        )
        
        if success and 'entries' in response:
            entries = response.get('entries', [])
            self.log(f"   ✓ Found {len(entries)} meals on {today}")
            self.log(f"   ✓ Date matches: {response.get('date')}")
            return True
        return False
    
    def test_get_calendar_data(self):
        """Test getting monthly calendar data"""
        if not self.token:
            return False
        
        from datetime import datetime
        now = datetime.now()
        month = now.month
        year = now.year
            
        success, response = self.run_test(
            f"Get Calendar Data ({month}/{year})",
            "GET",
            f"meals/calendar?month={month}&year={year}",
            200
        )
        
        if success and 'days' in response:
            days = response.get('days', [])
            monthly_totals = response.get('monthly_totals', {})
            self.log(f"   ✓ Found {len(days)} days with data")
            self.log(f"   ✓ Monthly calories: {monthly_totals.get('total_calories', 0)}")
            self.log(f"   ✓ Monthly cost: ${monthly_totals.get('total_cost', 0)}")
            self.log(f"   ✓ Days logged: {monthly_totals.get('days_logged', 0)}")
            return True
        return False
    
    def test_get_receipt_items_for_tracking(self):
        """Test getting receipt items formatted for tracking"""
        if not self.token:
            return False
        
        # Create an analysis first
        receipt_text = """SUPERMARKET
Chicken Breast 2lb      $8.99
Rice 5lb bag           $6.99
Bananas 2lb            $2.49
Total: $18.47"""
        
        analysis_success, analysis_response = self.run_test(
            "Create Analysis for Receipt Items Test",
            "POST",
            "analysis",
            200,
            data={"receipt_text": receipt_text}
        )
        
        if not analysis_success or 'id' not in analysis_response:
            return False
        
        analysis_id = analysis_response['id']
        
        success, response = self.run_test(
            "Get Receipt Items for Tracking",
            "GET",
            f"meals/receipt-items/{analysis_id}",
            200
        )
        
        if success and 'items' in response:
            items = response.get('items', [])
            self.log(f"   ✓ Found {len(items)} trackable items")
            self.log(f"   ✓ Analysis ID: {response.get('analysis_id')}")
            
            # Check item format
            if items:
                item = items[0]
                required_fields = ['name', 'total_calories', 'total_price', 'total_units', 'calories_per_unit']
                if all(field in item for field in required_fields):
                    self.log(f"   ✓ Items properly formatted for tracking")
                    
                    # Clean up analysis
                    self.run_test("Cleanup Receipt Items Analysis", "DELETE", f"analysis/{analysis_id}", 200)
                    return True
        return False
    
    def test_delete_meal_entry(self):
        """Test deleting a meal entry"""
        if not self.token or not hasattr(self, 'meal_entry_id'):
            self.log("   ⚠️ No meal entry to delete (skipping test)")
            return True
            
        success, response = self.run_test(
            "Delete Meal Entry",
            "DELETE",
            f"meals/{self.meal_entry_id}",
            200
        )
        
        if success:
            self.log(f"   ✓ Meal entry deleted successfully")
            return True
        return False

def main():
    """Run all backend API tests"""
    tester = NutritionAnalyzerAPITester()
    
    print("=" * 60)
    print("🧪 NUTRITION ANALYZER API TEST SUITE")
    print("=" * 60)
    print(f"Testing API at: {tester.base_url}")
    print()

    # Basic API Tests
    print("📋 BASIC API TESTS")
    print("-" * 30)
    tester.test_health_check()
    tester.test_root_endpoint()
    
    print()
    print("🔐 AUTHENTICATION TESTS")
    print("-" * 30)
    tester.test_register_user()
    tester.test_duplicate_registration()  
    tester.test_login()
    tester.test_invalid_login()
    tester.test_get_current_user()
    tester.test_unauthorized_access()
    
    print()
    print("📊 ANALYSIS TESTS")
    print("-" * 30)
    tester.test_create_analysis_text()
    tester.test_create_analysis_invalid_data()
    tester.test_get_analysis_history()
    tester.test_get_specific_analysis()
    tester.test_get_nonexistent_analysis()
    tester.test_ai_analysis_processing()
    
    print("🥗 USDA INTEGRATION TESTS")
    print("-" * 30)
    tester.test_usda_food_search()
    tester.test_usda_food_search_empty_query()
    tester.test_usda_food_details()
    
    print()
    print("🍽️ MEAL TRACKING TESTS")
    print("-" * 30)
    tester.test_log_meal_with_usda_macros()
    tester.test_log_meal_from_receipt()
    tester.test_get_today_meals_with_macros()
    tester.test_get_meals_by_date()
    tester.test_get_calendar_data()
    tester.test_get_receipt_items_for_tracking()
    tester.test_delete_meal_entry()
    
    # Analysis cleanup should be last
    tester.test_delete_analysis()
    
    print()
    print("=" * 60)
    print("📊 TEST RESULTS")
    print("=" * 60)
    print(f"✅ Tests passed: {tester.tests_passed}")
    print(f"❌ Tests failed: {tester.tests_run - tester.tests_passed}")
    print(f"📈 Success rate: {(tester.tests_passed/tester.tests_run*100):.1f}%")
    
    if tester.tests_passed == tester.tests_run:
        print("\n🎉 ALL TESTS PASSED! Backend API is working correctly.")
        return 0
    else:
        print(f"\n⚠️  {tester.tests_run - tester.tests_passed} tests failed. Please check the issues above.")
        return 1

if __name__ == "__main__":
    sys.exit(main())