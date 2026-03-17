# CalorieCost - Nutrition Cost Analysis App

## Original Problem Statement
Build a nutrition and cost analysis assistant that:
- Analyzes grocery receipts and calculates calories per dollar
- Extracts food items and prices from receipts (ignoring taxes, totals, non-food)
- Normalizes item names
- Estimates calories using AI + built-in database
- Outputs table with item name, total calories, price, calories per dollar
- Ranks items from highest to lowest calories per dollar
- Provides insights: best/worst value foods, suggestions for improving calorie efficiency

## User Requirements
- Both receipt input methods (image upload + manual text)
- AI + built-in database for calorie estimation
- Save analysis history with user accounts
- Light/Dark theme toggle

## Architecture
- **Frontend**: React 19 with Tailwind CSS, shadcn/ui components
- **Backend**: FastAPI with Python
- **Database**: MongoDB (Motor async driver)
- **AI**: OpenAI GPT-5.2 via emergentintegrations library for OCR and calorie estimation
- **Auth**: JWT-based authentication

## User Personas
1. **Health-conscious individuals** - Want to understand nutritional value of purchases
2. **Budget-conscious shoppers** - Seeking maximum nutrition per dollar
3. **Fitness enthusiasts** - Tracking macros and calorie efficiency
4. **Meal preppers** - Planning cost-effective meal preparation

## Core Requirements (Static)
- [ ] User authentication (register/login)
- [ ] Receipt image upload with OCR extraction
- [ ] Manual receipt text input
- [ ] AI-powered calorie estimation
- [ ] Built-in calorie database fallback
- [ ] Items ranked by calories per dollar
- [ ] Best/worst value identification
- [ ] Actionable insights
- [ ] Analysis history persistence
- [ ] Dark/Light theme toggle

## What's Been Implemented
### March 17, 2026 - MVP Complete
- ✅ Landing page with Bio-Metric Finance design aesthetic
- ✅ User authentication (JWT-based register/login)
- ✅ Dashboard with analysis history and stats
- ✅ Analyze page with dual input modes (image upload & manual text)
- ✅ GPT-5.2 integration for receipt OCR and calorie estimation
- ✅ Analysis results with ranked items table
- ✅ Best/worst value foods identification
- ✅ AI-generated insights
- ✅ Dark/Light theme toggle
- ✅ Analysis CRUD operations (create, read, delete)
- ✅ Responsive design with Outfit/Inter/JetBrains Mono fonts

## Prioritized Backlog
### P0 (Critical)
- None - MVP complete

### P1 (High Priority)
- [ ] Export analysis as CSV/PDF
- [ ] Weekly/monthly spending summaries
- [ ] Shopping list recommendations based on calorie efficiency
- [ ] Barcode scanning integration

### P2 (Medium Priority)
- [ ] Social sharing of analysis results
- [ ] Compare multiple receipts side-by-side
- [ ] Nutritional goals tracking
- [ ] Price alerts for high-value foods

## Next Action Items
1. Add export functionality (CSV/PDF)
2. Implement weekly spending analytics
3. Add shopping recommendations engine
4. Consider barcode scanning for faster input
