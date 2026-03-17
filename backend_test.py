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