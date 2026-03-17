import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Skeleton } from '../components/ui/skeleton';
import { Badge } from '../components/ui/badge';
import { Calendar } from '../components/ui/calendar';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '../components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '../components/ui/popover';
import { 
  Plus, 
  Flame, 
  DollarSign,
  Trash2,
  CalendarIcon,
  Search,
  Loader2,
  UtensilsCrossed,
  TrendingUp,
  Beef,
  Wheat,
  Droplets,
  Leaf,
  Cookie,
  X,
  Receipt,
  ArrowRight,
  CheckCircle2
} from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const MEAL_TYPES = [
  { value: 'breakfast', label: 'Breakfast', icon: '🌅' },
  { value: 'lunch', label: 'Lunch', icon: '☀️' },
  { value: 'dinner', label: 'Dinner', icon: '🌙' },
  { value: 'snack', label: 'Snack', icon: '🍿' },
];

export default function Track() {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [dailyData, setDailyData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('chronological');
  
  // Add food modal state
  const [showAddModal, setShowAddModal] = useState(false);
  const [addSource, setAddSource] = useState('search'); // 'search' or 'receipt'
  
  // Search mode state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  
  // Receipt mode state
  const [receipts, setReceipts] = useState([]);
  const [selectedReceipt, setSelectedReceipt] = useState(null);
  const [receiptItems, setReceiptItems] = useState([]);
  const [selectedReceiptItem, setSelectedReceiptItem] = useState(null);
  const [usdaMatches, setUsdaMatches] = useState([]);
  const [searchingUsda, setSearchingUsda] = useState(false);
  
  // Selected food state
  const [selectedFood, setSelectedFood] = useState(null);
  const [foodDetails, setFoodDetails] = useState(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  
  // Form state
  const [selectedServing, setSelectedServing] = useState(null);
  const [customGrams, setCustomGrams] = useState('');
  const [mealType, setMealType] = useState('');
  const [totalPrice, setTotalPrice] = useState('');
  const [totalGramsPurchased, setTotalGramsPurchased] = useState('');

  const searchTimeoutRef = useRef(null);

  useEffect(() => {
    fetchDailyData();
    fetchReceipts();
  }, [selectedDate]);

  const fetchDailyData = async () => {
    setLoading(true);
    try {
      const dateStr = format(selectedDate, 'yyyy-MM-dd');
      const response = await axios.get(`${API}/meals/date/${dateStr}`);
      setDailyData(response.data);
    } catch (error) {
      toast.error('Failed to load daily data');
    } finally {
      setLoading(false);
    }
  };

  const fetchReceipts = async () => {
    try {
      const response = await axios.get(`${API}/analysis`);
      setReceipts(response.data);
    } catch (error) {
      console.error('Failed to fetch receipts');
    }
  };

  const fetchReceiptItems = async (analysisId) => {
    try {
      const response = await axios.get(`${API}/meals/receipt-items/${analysisId}`);
      setReceiptItems(response.data.items);
    } catch (error) {
      toast.error('Failed to load receipt items');
    }
  };

  const handleSearch = (query) => {
    setSearchQuery(query);
    
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }
    
    searchTimeoutRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const response = await axios.get(`${API}/food-search?q=${encodeURIComponent(query)}`);
        setSearchResults(response.data.items || []);
      } catch (error) {
        toast.error('Search failed');
      } finally {
        setSearching(false);
      }
    }, 300);
  };

  const handleSelectFood = async (food) => {
    setSelectedFood(food);
    setLoadingDetails(true);
    setSearchResults([]);
    setUsdaMatches([]);
    setSearchQuery(food.name);
    
    try {
      const response = await axios.get(`${API}/food/${food.fdc_id}`);
      setFoodDetails(response.data);
      if (response.data.serving_sizes?.length > 0) {
        setSelectedServing(response.data.serving_sizes[0]);
      }
    } catch (error) {
      toast.error('Failed to load food details');
    } finally {
      setLoadingDetails(false);
    }
  };

  // Receipt handling
  const handleReceiptSelect = (analysisId) => {
    setSelectedReceipt(analysisId);
    setSelectedReceiptItem(null);
    setUsdaMatches([]);
    setSelectedFood(null);
    setFoodDetails(null);
    if (analysisId) {
      fetchReceiptItems(analysisId);
    } else {
      setReceiptItems([]);
    }
  };

  const handleReceiptItemSelect = async (item) => {
    setSelectedReceiptItem(item);
    setSelectedFood(null);
    setFoodDetails(null);
    setUsdaMatches([]);
    
    // Pre-fill price from receipt
    setTotalPrice(item.total_price.toString());
    setTotalGramsPurchased(item.total_grams?.toString() || '');
    
    // Search USDA for this item
    setSearchingUsda(true);
    try {
      const response = await axios.get(`${API}/food-search?q=${encodeURIComponent(item.name)}`);
      setUsdaMatches(response.data.items || []);
    } catch (error) {
      toast.error('Failed to find USDA matches');
    } finally {
      setSearchingUsda(false);
    }
  };

  const getServingGrams = () => {
    if (customGrams) return parseFloat(customGrams);
    if (selectedServing) return selectedServing.grams;
    return 100;
  };

  const calculateNutrients = () => {
    if (!foodDetails) return null;
    const grams = getServingGrams();
    const multiplier = grams / 100;
    const n = foodDetails.nutrients_per_100g;
    
    return {
      calories: Math.round(n.calories * multiplier),
      protein: (n.protein * multiplier).toFixed(1),
      carbs: (n.carbs * multiplier).toFixed(1),
      fat: (n.fat * multiplier).toFixed(1),
      fiber: (n.fiber * multiplier).toFixed(1),
      sugar: (n.sugar * multiplier).toFixed(1),
    };
  };

  const calculateCost = () => {
    if (!totalPrice || !totalGramsPurchased) return null;
    const servingGrams = getServingGrams();
    const cost = (parseFloat(totalPrice) / parseFloat(totalGramsPurchased)) * servingGrams;
    return cost.toFixed(2);
  };

  const handleLogMeal = async () => {
    if (!foodDetails) return;
    
    const servingGrams = getServingGrams();
    const servingDesc = customGrams 
      ? `${customGrams}g` 
      : selectedServing?.description || `${servingGrams}g`;
    
    setSubmitting(true);
    try {
      await axios.post(`${API}/meals/log`, {
        item_name: foodDetails.name,
        fdc_id: foodDetails.fdc_id,
        calories_per_100g: foodDetails.nutrients_per_100g.calories,
        protein_per_100g: foodDetails.nutrients_per_100g.protein,
        carbs_per_100g: foodDetails.nutrients_per_100g.carbs,
        fat_per_100g: foodDetails.nutrients_per_100g.fat,
        fiber_per_100g: foodDetails.nutrients_per_100g.fiber,
        sugar_per_100g: foodDetails.nutrients_per_100g.sugar,
        serving_description: servingDesc,
        serving_grams: servingGrams,
        total_grams_purchased: parseFloat(totalGramsPurchased) || servingGrams,
        total_price: parseFloat(totalPrice) || 0,
        meal_type: mealType || null,
        source: addSource === 'receipt' ? 'receipt' : 'usda'
      });
      
      toast.success('Meal logged!');
      fetchDailyData();
      resetModal();
    } catch (error) {
      toast.error('Failed to log meal');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteEntry = async (entryId) => {
    try {
      await axios.delete(`${API}/meals/${entryId}`);
      toast.success('Entry deleted');
      fetchDailyData();
    } catch (error) {
      toast.error('Failed to delete entry');
    }
  };

  const resetModal = () => {
    setShowAddModal(false);
    setAddSource('search');
    setSearchQuery('');
    setSearchResults([]);
    setSelectedFood(null);
    setFoodDetails(null);
    setSelectedServing(null);
    setCustomGrams('');
    setMealType('');
    setTotalPrice('');
    setTotalGramsPurchased('');
    setSelectedReceipt(null);
    setReceiptItems([]);
    setSelectedReceiptItem(null);
    setUsdaMatches([]);
  };

  const nutrients = calculateNutrients();
  const cost = calculateCost();

  const renderMealEntries = (entries, title, icon) => {
    if (!entries || entries.length === 0) return null;
    
    const totalCal = entries.reduce((sum, e) => sum + e.calories, 0);
    
    return (
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-lg">{icon}</span>
          <h3 className="font-outfit font-semibold">{title}</h3>
          <Badge variant="secondary" className="ml-auto">{totalCal} cal</Badge>
        </div>
        <div className="space-y-2">
          {entries.map((entry) => (
            <MealEntryCard 
              key={entry.id} 
              entry={entry} 
              onDelete={() => handleDeleteEntry(entry.id)} 
            />
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-6xl mx-auto px-4 md:px-8 py-8" data-testid="track-page">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
        <div>
          <h1 className="font-outfit font-bold text-3xl md:text-4xl tracking-tight">Daily Tracker</h1>
          <p className="text-muted-foreground font-inter mt-1">Track nutrition with USDA-verified data</p>
        </div>
        <div className="flex items-center gap-3">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="font-outfit" data-testid="date-picker-trigger">
                <CalendarIcon className="w-4 h-4 mr-2" />
                {format(selectedDate, 'MMM d, yyyy')}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={(date) => date && setSelectedDate(date)}
                initialFocus
              />
            </PopoverContent>
          </Popover>
          <Link to="/calendar" data-testid="view-calendar-link">
            <Button variant="outline" className="font-outfit">
              <TrendingUp className="w-4 h-4 mr-2" />
              Calendar
            </Button>
          </Link>
        </div>
      </div>

      {/* Summary Card */}
      <Card className="border-border/50 rounded-2xl mb-8" data-testid="summary-card">
        <CardContent className="p-6">
          {loading ? (
            <div className="space-y-4">
              <Skeleton className="h-12 w-48" />
              <div className="grid grid-cols-4 gap-4">
                {[1,2,3,4].map(i => <Skeleton key={i} className="h-20" />)}
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between mb-6">
                <div>
                  <p className="text-sm text-muted-foreground font-inter">Total Calories</p>
                  <p className="font-mono text-4xl font-bold">{dailyData?.total_calories || 0}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-muted-foreground">Daily Cost</p>
                  <p className="font-mono text-2xl font-bold text-accent">${dailyData?.total_cost?.toFixed(2) || '0.00'}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
                <MacroCard icon={<Beef className="w-4 h-4" />} label="Protein" value={dailyData?.total_protein || 0} unit="g" color="text-red-500" bgColor="bg-red-500/10" />
                <MacroCard icon={<Wheat className="w-4 h-4" />} label="Carbs" value={dailyData?.total_carbs || 0} unit="g" color="text-amber-500" bgColor="bg-amber-500/10" />
                <MacroCard icon={<Droplets className="w-4 h-4" />} label="Fat" value={dailyData?.total_fat || 0} unit="g" color="text-blue-500" bgColor="bg-blue-500/10" />
                <MacroCard icon={<Leaf className="w-4 h-4" />} label="Fiber" value={dailyData?.total_fiber || 0} unit="g" color="text-green-500" bgColor="bg-green-500/10" />
                <MacroCard icon={<Cookie className="w-4 h-4" />} label="Sugar" value={dailyData?.total_sugar || 0} unit="g" color="text-pink-500" bgColor="bg-pink-500/10" />
                <MacroCard icon={<UtensilsCrossed className="w-4 h-4" />} label="Meals" value={dailyData?.meal_count || 0} unit="" color="text-primary" bgColor="bg-primary/10" />
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* View Toggle & Add Button */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2 bg-muted/50 p-1 rounded-lg">
          <Button variant={viewMode === 'chronological' ? 'secondary' : 'ghost'} size="sm" onClick={() => setViewMode('chronological')} data-testid="view-chronological">
            Chronological
          </Button>
          <Button variant={viewMode === 'by-meal' ? 'secondary' : 'ghost'} size="sm" onClick={() => setViewMode('by-meal')} data-testid="view-by-meal">
            By Meal
          </Button>
        </div>
        <Button onClick={() => setShowAddModal(true)} data-testid="add-food-btn">
          <Plus className="w-4 h-4 mr-2" />
          Add Food
        </Button>
      </div>

      {/* Meal List */}
      <Card className="border-border/50 rounded-2xl" data-testid="meal-list-card">
        <CardContent className="p-6">
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-20 rounded-xl" />)}
            </div>
          ) : !dailyData?.entries?.length ? (
            <EmptyState onAdd={() => setShowAddModal(true)} />
          ) : viewMode === 'by-meal' ? (
            <div>
              {renderMealEntries(dailyData.entries_by_meal?.breakfast, 'Breakfast', '🌅')}
              {renderMealEntries(dailyData.entries_by_meal?.lunch, 'Lunch', '☀️')}
              {renderMealEntries(dailyData.entries_by_meal?.dinner, 'Dinner', '🌙')}
              {renderMealEntries(dailyData.entries_by_meal?.snack, 'Snacks', '🍿')}
              {renderMealEntries(dailyData.entries_by_meal?.other, 'Other', '🍽️')}
            </div>
          ) : (
            <div className="space-y-3">
              {dailyData.entries.map((entry) => (
                <MealEntryCard key={entry.id} entry={entry} onDelete={() => handleDeleteEntry(entry.id)} showMealType />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Food Modal */}
      <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-outfit text-xl">Add Food</DialogTitle>
            <DialogDescription>Search USDA database or add from your receipts</DialogDescription>
          </DialogHeader>

          {/* Source Toggle */}
          <div className="flex gap-2 mb-4">
            <Button
              variant={addSource === 'search' ? 'default' : 'outline'}
              size="sm"
              onClick={() => {
                setAddSource('search');
                setSelectedReceiptItem(null);
                setUsdaMatches([]);
                setSelectedFood(null);
                setFoodDetails(null);
              }}
              className="flex-1"
              data-testid="source-search"
            >
              <Search className="w-4 h-4 mr-2" />
              Search USDA
            </Button>
            <Button
              variant={addSource === 'receipt' ? 'default' : 'outline'}
              size="sm"
              onClick={() => {
                setAddSource('receipt');
                setSearchResults([]);
                setSelectedFood(null);
                setFoodDetails(null);
              }}
              className="flex-1"
              data-testid="source-receipt"
            >
              <Receipt className="w-4 h-4 mr-2" />
              From Receipt
            </Button>
          </div>

          {addSource === 'search' ? (
            // Direct USDA Search
            <>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  value={searchQuery}
                  onChange={(e) => handleSearch(e.target.value)}
                  placeholder="Search foods... (e.g., chicken breast, banana)"
                  className="pl-10"
                  data-testid="food-search-input"
                />
                {searching && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin" />}
              </div>

              {searchResults.length > 0 && !selectedFood && (
                <div className="border rounded-xl max-h-60 overflow-auto">
                  {searchResults.map((food, i) => (
                    <button
                      key={food.fdc_id}
                      className="w-full p-4 text-left hover:bg-muted/50 transition-colors border-b last:border-0"
                      onClick={() => handleSelectFood(food)}
                      data-testid={`search-result-${i}`}
                    >
                      <p className="font-medium">{food.name}</p>
                      <p className="text-sm text-muted-foreground">
                        Per 100g: {food.nutrients_per_100g.calories} cal | P: {food.nutrients_per_100g.protein}g | C: {food.nutrients_per_100g.carbs}g | F: {food.nutrients_per_100g.fat}g
                      </p>
                    </button>
                  ))}
                </div>
              )}
            </>
          ) : (
            // Receipt Mode
            <>
              {!selectedReceiptItem ? (
                // Step 1: Select receipt and item
                <div className="space-y-4">
                  <Select value={selectedReceipt || ''} onValueChange={handleReceiptSelect}>
                    <SelectTrigger data-testid="receipt-select">
                      <SelectValue placeholder="Select a receipt..." />
                    </SelectTrigger>
                    <SelectContent>
                      {receipts.map((r) => (
                        <SelectItem key={r.id} value={r.id}>
                          {format(new Date(r.created_at), 'MMM d')} - {r.item_count} items (${r.total_cost})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {receiptItems.length > 0 && (
                    <div className="space-y-2 max-h-60 overflow-auto">
                      <p className="text-sm text-muted-foreground">Select an item to find its nutrition data:</p>
                      {receiptItems.map((item, i) => (
                        <button
                          key={i}
                          className="w-full p-4 rounded-xl text-left transition-colors bg-muted/50 hover:bg-muted border border-transparent hover:border-primary/30"
                          onClick={() => handleReceiptItemSelect(item)}
                          data-testid={`receipt-item-${i}`}
                        >
                          <div className="flex justify-between items-center">
                            <span className="font-medium">{item.name}</span>
                            <span className="text-accent font-mono">${item.total_price}</span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            {item.quantity || `~${item.total_grams}g`}
                          </p>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ) : !selectedFood ? (
                // Step 2: Match with USDA
                <div className="space-y-4">
                  <div className="p-4 bg-accent/10 rounded-xl border border-accent/30">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">From receipt:</p>
                        <p className="font-semibold">{selectedReceiptItem.name}</p>
                        <p className="text-sm text-accent font-mono">${selectedReceiptItem.total_price}</p>
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => {
                        setSelectedReceiptItem(null);
                        setUsdaMatches([]);
                      }}>
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <ArrowRight className="w-4 h-4" />
                    <span>Select matching food from USDA database:</span>
                  </div>

                  {searchingUsda ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="w-6 h-6 animate-spin text-primary" />
                      <span className="ml-2 text-muted-foreground">Searching USDA...</span>
                    </div>
                  ) : usdaMatches.length > 0 ? (
                    <div className="space-y-2 max-h-60 overflow-auto">
                      {usdaMatches.map((food, i) => (
                        <button
                          key={food.fdc_id}
                          className="w-full p-4 rounded-xl text-left transition-colors bg-muted/50 hover:bg-primary/10 border border-transparent hover:border-primary/30"
                          onClick={() => handleSelectFood(food)}
                          data-testid={`usda-match-${i}`}
                        >
                          <p className="font-medium">{food.name}</p>
                          <p className="text-sm text-muted-foreground">
                            Per 100g: {food.nutrients_per_100g.calories} cal | P: {food.nutrients_per_100g.protein}g | C: {food.nutrients_per_100g.carbs}g | F: {food.nutrients_per_100g.fat}g
                          </p>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="text-center text-muted-foreground py-4">No USDA matches found. Try searching manually.</p>
                  )}

                  {/* Manual search option */}
                  <div className="pt-4 border-t">
                    <p className="text-sm text-muted-foreground mb-2">Can't find it? Search manually:</p>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        placeholder="Search USDA database..."
                        className="pl-10"
                        onChange={(e) => {
                          const query = e.target.value;
                          if (query.length >= 2) {
                            setSearchingUsda(true);
                            axios.get(`${API}/food-search?q=${encodeURIComponent(query)}`)
                              .then(res => setUsdaMatches(res.data.items || []))
                              .finally(() => setSearchingUsda(false));
                          }
                        }}
                      />
                    </div>
                  </div>
                </div>
              ) : null}
            </>
          )}

          {/* Selected Food Details - shown for both modes */}
          {selectedFood && (
            <div className="space-y-4">
              {loadingDetails ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                </div>
              ) : foodDetails && (
                <>
                  {/* Food Name & Source indicator */}
                  <div className="flex items-center justify-between p-4 bg-primary/5 rounded-xl">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-outfit font-semibold">{foodDetails.name}</p>
                        {addSource === 'receipt' && (
                          <Badge variant="secondary" className="text-xs">
                            <Receipt className="w-3 h-3 mr-1" />
                            From Receipt
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">Per 100g: {foodDetails.nutrients_per_100g.calories} cal</p>
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => {
                      setSelectedFood(null);
                      setFoodDetails(null);
                      if (addSource === 'search') setSearchQuery('');
                    }}>
                      <X className="w-4 h-4" />
                    </Button>
                  </div>

                  {/* Serving Size Selection */}
                  <div>
                    <label className="text-sm font-medium mb-2 block">Select Serving Size</label>
                    <div className="grid grid-cols-2 gap-2">
                      {foodDetails.serving_sizes?.map((serving, i) => (
                        <button
                          key={i}
                          className={`p-3 rounded-lg border text-left transition-colors ${
                            selectedServing?.description === serving.description && !customGrams
                              ? 'border-primary bg-primary/10'
                              : 'border-border hover:border-primary/50'
                          }`}
                          onClick={() => { setSelectedServing(serving); setCustomGrams(''); }}
                          data-testid={`serving-${i}`}
                        >
                          <p className="font-medium text-sm">{serving.description}</p>
                          <p className="text-xs text-muted-foreground">{serving.grams}g</p>
                        </button>
                      ))}
                    </div>
                    
                    <div className="mt-3">
                      <label className="text-sm text-muted-foreground mb-1 block">Or enter custom amount (grams)</label>
                      <Input
                        type="number"
                        value={customGrams}
                        onChange={(e) => { setCustomGrams(e.target.value); setSelectedServing(null); }}
                        placeholder="e.g., 150"
                        className="font-mono"
                        data-testid="custom-grams"
                      />
                    </div>
                  </div>

                  {/* Meal Type */}
                  <div>
                    <label className="text-sm font-medium mb-2 block">Meal Type (optional)</label>
                    <Select value={mealType} onValueChange={setMealType}>
                      <SelectTrigger data-testid="meal-type-select">
                        <SelectValue placeholder="Select meal type..." />
                      </SelectTrigger>
                      <SelectContent>
                        {MEAL_TYPES.map(type => (
                          <SelectItem key={type.value} value={type.value}>
                            {type.icon} {type.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Cost Tracking */}
                  <div className="p-4 bg-muted/30 rounded-xl">
                    <p className="text-sm font-medium mb-3">
                      Cost Tracking {addSource === 'receipt' && <span className="text-primary">(pre-filled from receipt)</span>}
                    </p>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs text-muted-foreground mb-1 block">Total Price Paid ($)</label>
                        <Input
                          type="number"
                          step="0.01"
                          value={totalPrice}
                          onChange={(e) => setTotalPrice(e.target.value)}
                          placeholder="e.g., 5.99"
                          className="font-mono"
                          data-testid="total-price"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground mb-1 block">Total Weight Purchased (g)</label>
                        <Input
                          type="number"
                          value={totalGramsPurchased}
                          onChange={(e) => setTotalGramsPurchased(e.target.value)}
                          placeholder="e.g., 500"
                          className="font-mono"
                          data-testid="total-grams"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Calculated Nutrition */}
                  {nutrients && (
                    <div className="p-4 border border-primary/30 bg-primary/5 rounded-xl">
                      <div className="flex items-center justify-between mb-3">
                        <p className="font-outfit font-semibold">This Serving</p>
                        <p className="text-sm text-muted-foreground">
                          {customGrams || selectedServing?.description || '100g'} ({getServingGrams()}g)
                        </p>
                      </div>
                      <div className="grid grid-cols-3 gap-3 text-center">
                        <div className="p-2 bg-background rounded-lg">
                          <p className="font-mono text-xl font-bold text-primary">{nutrients.calories}</p>
                          <p className="text-xs text-muted-foreground">Calories</p>
                        </div>
                        <div className="p-2 bg-background rounded-lg">
                          <p className="font-mono text-lg font-semibold text-red-500">{nutrients.protein}g</p>
                          <p className="text-xs text-muted-foreground">Protein</p>
                        </div>
                        <div className="p-2 bg-background rounded-lg">
                          <p className="font-mono text-lg font-semibold text-amber-500">{nutrients.carbs}g</p>
                          <p className="text-xs text-muted-foreground">Carbs</p>
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-3 text-center mt-2">
                        <div className="p-2 bg-background rounded-lg">
                          <p className="font-mono text-lg font-semibold text-blue-500">{nutrients.fat}g</p>
                          <p className="text-xs text-muted-foreground">Fat</p>
                        </div>
                        <div className="p-2 bg-background rounded-lg">
                          <p className="font-mono text-lg font-semibold text-green-500">{nutrients.fiber}g</p>
                          <p className="text-xs text-muted-foreground">Fiber</p>
                        </div>
                        <div className="p-2 bg-background rounded-lg">
                          <p className="font-mono text-lg font-semibold text-pink-500">{nutrients.sugar}g</p>
                          <p className="text-xs text-muted-foreground">Sugar</p>
                        </div>
                      </div>
                      {cost && (
                        <div className="mt-3 pt-3 border-t border-border/50 flex items-center justify-between">
                          <p className="text-sm text-muted-foreground">Serving Cost</p>
                          <p className="font-mono font-bold text-accent">${cost}</p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Add Button */}
                  <Button
                    className="w-full h-12"
                    onClick={handleLogMeal}
                    disabled={submitting || !getServingGrams()}
                    data-testid="log-meal-btn"
                  >
                    {submitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
                    Add to Log
                  </Button>
                </>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Macro Card Component
function MacroCard({ icon, label, value, unit, color, bgColor }) {
  return (
    <div className={`p-3 rounded-xl ${bgColor}`}>
      <div className={`flex items-center gap-2 ${color} mb-1`}>
        {icon}
        <span className="text-xs font-medium">{label}</span>
      </div>
      <p className="font-mono text-lg font-bold">
        {typeof value === 'number' ? value.toFixed(1) : value}{unit}
      </p>
    </div>
  );
}

// Meal Entry Card Component
function MealEntryCard({ entry, onDelete, showMealType = false }) {
  return (
    <div className="flex items-center justify-between p-4 rounded-xl bg-muted/50 hover:bg-muted/70 transition-colors group" data-testid={`meal-entry-${entry.id}`}>
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <p className="font-medium">{entry.item_name}</p>
          {showMealType && entry.meal_type && (
            <Badge variant="outline" className="text-xs capitalize">{entry.meal_type}</Badge>
          )}
          {entry.source === 'receipt' && (
            <Badge variant="secondary" className="text-xs">
              <Receipt className="w-3 h-3 mr-1" />
              Receipt
            </Badge>
          )}
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          {entry.serving_description} • {format(new Date(entry.timestamp), 'h:mm a')}
        </p>
        <div className="flex items-center gap-3 mt-2 text-xs">
          <span className="text-red-500">P: {entry.protein}g</span>
          <span className="text-amber-500">C: {entry.carbs}g</span>
          <span className="text-blue-500">F: {entry.fat}g</span>
        </div>
      </div>
      <div className="flex items-center gap-4">
        <div className="text-right">
          <p className="font-mono text-lg font-bold text-primary">{entry.calories} cal</p>
          {entry.cost > 0 && <p className="font-mono text-sm text-accent">${entry.cost.toFixed(2)}</p>}
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={onDelete}
          className="opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive"
          data-testid={`delete-entry-${entry.id}`}
        >
          <Trash2 className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}

// Empty State Component
function EmptyState({ onAdd }) {
  return (
    <div className="text-center py-12">
      <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-4">
        <UtensilsCrossed className="w-8 h-8 text-muted-foreground" />
      </div>
      <h3 className="font-outfit font-semibold text-lg mb-2">No meals logged</h3>
      <p className="text-muted-foreground text-sm mb-6">Start tracking your nutrition with USDA-verified data</p>
      <Button onClick={onAdd}>
        <Plus className="w-4 h-4 mr-2" />
        Add Food
      </Button>
    </div>
  );
}
