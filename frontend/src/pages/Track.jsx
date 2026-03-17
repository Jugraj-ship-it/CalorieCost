import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Skeleton } from '../components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import { Calendar } from '../components/ui/calendar';
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
  Receipt,
  Search,
  Loader2,
  UtensilsCrossed,
  TrendingUp,
  Scale
} from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Food Autocomplete Component
const FoodAutocomplete = ({ value, onChange, onSelect, placeholder }) => {
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [loading, setLoading] = useState(false);
  const wrapperRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const searchFoods = async (query) => {
    if (query.length < 2) {
      setSuggestions([]);
      return;
    }
    
    setLoading(true);
    try {
      const response = await axios.get(`${API}/food-database?q=${encodeURIComponent(query)}`);
      setSuggestions(response.data.items || []);
    } catch (error) {
      setSuggestions([]);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const newValue = e.target.value;
    onChange(newValue);
    setShowSuggestions(true);
    searchFoods(newValue);
  };

  const handleSelect = (item) => {
    onSelect(item);
    setShowSuggestions(false);
    setSuggestions([]);
  };

  return (
    <div ref={wrapperRef} className="relative">
      <div className="relative">
        <Input
          value={value}
          onChange={handleInputChange}
          onFocus={() => value.length >= 2 && setShowSuggestions(true)}
          placeholder={placeholder}
          className="pr-8"
          data-testid="food-search-input"
        />
        {loading ? (
          <Loader2 className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-muted-foreground" />
        ) : (
          <Search className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        )}
      </div>
      
      {showSuggestions && suggestions.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-popover border border-border rounded-xl shadow-lg max-h-60 overflow-auto">
          {suggestions.map((item, index) => (
            <button
              key={index}
              className="w-full px-4 py-3 text-left hover:bg-muted/50 transition-colors flex items-center justify-between border-b border-border/50 last:border-0"
              onClick={() => handleSelect(item)}
              data-testid={`food-suggestion-${index}`}
            >
              <div>
                <p className="font-medium text-sm">{item.name}</p>
                <p className="text-xs text-muted-foreground">~{item.typical_grams}g typical</p>
              </div>
              <div className="text-right">
                <p className="font-mono text-sm text-primary font-semibold">{item.calories_per_100g} cal</p>
                <p className="text-xs text-muted-foreground">per 100g</p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default function Track() {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [dailyData, setDailyData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [receipts, setReceipts] = useState([]);
  const [selectedReceipt, setSelectedReceipt] = useState(null);
  const [receiptItems, setReceiptItems] = useState([]);
  const [addSource, setAddSource] = useState('database'); // 'database' or 'receipt'
  const [submitting, setSubmitting] = useState(false);
  
  // Form state for adding meals - gram-based
  const [formData, setFormData] = useState({
    item_name: '',
    calories_per_100g: 0,
    total_grams: 100,
    grams_consumed: 100,
    total_price: 0
  });

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

  const handleReceiptSelect = (analysisId) => {
    setSelectedReceipt(analysisId);
    if (analysisId) {
      fetchReceiptItems(analysisId);
    } else {
      setReceiptItems([]);
    }
  };

  const handleFoodSelect = (item) => {
    setFormData({
      ...formData,
      item_name: item.name,
      calories_per_100g: item.calories_per_100g,
      total_grams: item.typical_grams || 100,
      grams_consumed: 100 // Default to 100g serving
    });
  };

  const handleReceiptItemSelect = (item) => {
    setFormData({
      item_name: item.name,
      calories_per_100g: item.calories_per_100g,
      total_grams: item.total_grams,
      grams_consumed: 100, // Default to 100g serving
      total_price: item.total_price
    });
  };

  const handleLogMeal = async () => {
    if (!formData.item_name || formData.grams_consumed <= 0) {
      toast.error('Please fill in item name and grams consumed');
      return;
    }

    setSubmitting(true);
    try {
      await axios.post(`${API}/meals/log`, {
        item_name: formData.item_name,
        calories_per_100g: formData.calories_per_100g,
        total_grams: formData.total_grams,
        grams_consumed: formData.grams_consumed,
        total_price: formData.total_price,
        source: addSource,
        source_id: selectedReceipt
      });
      
      toast.success('Meal logged!');
      fetchDailyData();
      resetForm();
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

  const resetForm = () => {
    setFormData({
      item_name: '',
      calories_per_100g: 0,
      total_grams: 100,
      grams_consumed: 100,
      total_price: 0
    });
    setSelectedReceipt(null);
    setReceiptItems([]);
  };

  // Calculate preview values
  const calculatedCalories = Math.round((formData.grams_consumed / 100) * formData.calories_per_100g);
  const calculatedCost = formData.total_grams > 0 
    ? ((formData.total_price / formData.total_grams) * formData.grams_consumed).toFixed(2)
    : '0.00';

  return (
    <div className="max-w-6xl mx-auto px-4 md:px-8 py-8" data-testid="track-page">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
        <div>
          <h1 className="font-outfit font-bold text-3xl md:text-4xl tracking-tight">Daily Tracker</h1>
          <p className="text-muted-foreground font-inter mt-1">Track your meals by weight for accurate cost calculation</p>
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
              View Calendar
            </Button>
          </Link>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <Card className="border-border/50 rounded-2xl" data-testid="stat-calories">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                <Flame className="w-6 h-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground font-inter">Total Calories</p>
                <p className="font-mono text-2xl font-bold">
                  {loading ? <Skeleton className="h-8 w-20" /> : dailyData?.total_calories.toLocaleString() || 0}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/50 rounded-2xl" data-testid="stat-cost">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center">
                <DollarSign className="w-6 h-6 text-accent" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground font-inter">Total Cost</p>
                <p className="font-mono text-2xl font-bold">
                  {loading ? <Skeleton className="h-8 w-20" /> : `$${dailyData?.total_cost.toFixed(2) || '0.00'}`}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/50 rounded-2xl" data-testid="stat-meals">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center">
                <UtensilsCrossed className="w-6 h-6 text-blue-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground font-inter">Meals Logged</p>
                <p className="font-mono text-2xl font-bold">
                  {loading ? <Skeleton className="h-8 w-20" /> : dailyData?.meal_count || 0}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Add Meal Form */}
        <Card className="border-border/50 rounded-2xl lg:col-span-1" data-testid="add-meal-card">
          <CardHeader>
            <CardTitle className="font-outfit flex items-center gap-2">
              <Scale className="w-5 h-5" />
              Log by Weight
            </CardTitle>
            <CardDescription>Track by grams for accurate cost per serving</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Source Selection */}
            <div className="flex gap-2">
              <Button
                variant={addSource === 'database' ? 'default' : 'outline'}
                size="sm"
                onClick={() => { setAddSource('database'); setSelectedReceipt(null); setReceiptItems([]); }}
                className="flex-1"
                data-testid="source-database"
              >
                <Search className="w-4 h-4 mr-2" />
                Database
              </Button>
              <Button
                variant={addSource === 'receipt' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setAddSource('receipt')}
                className="flex-1"
                data-testid="source-receipt"
              >
                <Receipt className="w-4 h-4 mr-2" />
                Receipt
              </Button>
            </div>

            {addSource === 'database' ? (
              // Database search
              <div className="space-y-4">
                <FoodAutocomplete
                  value={formData.item_name}
                  onChange={(val) => setFormData({ ...formData, item_name: val })}
                  onSelect={handleFoodSelect}
                  placeholder="Search food..."
                />
                
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Cal per 100g</label>
                    <Input
                      type="number"
                      value={formData.calories_per_100g || ''}
                      onChange={(e) => setFormData({ ...formData, calories_per_100g: parseInt(e.target.value) || 0 })}
                      className="font-mono"
                      data-testid="input-cal-per-100g"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Total Price ($)</label>
                    <Input
                      type="number"
                      step="0.01"
                      value={formData.total_price || ''}
                      onChange={(e) => setFormData({ ...formData, total_price: parseFloat(e.target.value) || 0 })}
                      className="font-mono"
                      data-testid="input-price"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Total Weight (g)</label>
                    <Input
                      type="number"
                      value={formData.total_grams || ''}
                      onChange={(e) => setFormData({ ...formData, total_grams: parseFloat(e.target.value) || 100 })}
                      className="font-mono"
                      data-testid="input-total-grams"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block font-semibold text-foreground">Grams Eaten</label>
                    <Input
                      type="number"
                      value={formData.grams_consumed || ''}
                      onChange={(e) => setFormData({ ...formData, grams_consumed: parseFloat(e.target.value) || 0 })}
                      className="font-mono border-primary"
                      data-testid="input-grams-consumed"
                    />
                  </div>
                </div>
              </div>
            ) : (
              // Receipt selection
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
                  <div className="space-y-2 max-h-40 overflow-auto">
                    {receiptItems.map((item, i) => (
                      <button
                        key={i}
                        className={`w-full p-3 rounded-lg text-left transition-colors ${
                          formData.item_name === item.name ? 'bg-primary/10 border border-primary/30' : 'bg-muted/50 hover:bg-muted'
                        }`}
                        onClick={() => handleReceiptItemSelect(item)}
                        data-testid={`receipt-item-${i}`}
                      >
                        <div className="flex justify-between items-center">
                          <span className="font-medium text-sm">{item.name}</span>
                          <span className="text-xs text-muted-foreground">${item.total_price}</span>
                        </div>
                        <p className="text-xs text-muted-foreground">{item.total_grams}g total • {item.calories_per_100g} cal/100g</p>
                      </button>
                    ))}
                  </div>
                )}

                {formData.item_name && addSource === 'receipt' && (
                  <div>
                    <label className="text-xs font-semibold text-foreground mb-1 block">Grams Eaten</label>
                    <Input
                      type="number"
                      value={formData.grams_consumed || ''}
                      onChange={(e) => setFormData({ ...formData, grams_consumed: parseFloat(e.target.value) || 0 })}
                      className="font-mono border-primary"
                      placeholder="How many grams did you eat?"
                      data-testid="receipt-grams-consumed"
                    />
                  </div>
                )}
              </div>
            )}

            {/* Calculated Preview */}
            {formData.item_name && (
              <div className="p-4 rounded-xl bg-primary/5 border border-primary/20">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-medium">{formData.item_name}</p>
                  <span className="text-xs text-muted-foreground">{formData.grams_consumed}g serving</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Calories:</span>
                  <span className="font-mono font-bold text-primary">{calculatedCalories} cal</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Cost:</span>
                  <span className="font-mono font-bold text-accent">${calculatedCost}</span>
                </div>
                <div className="mt-2 pt-2 border-t border-border/50">
                  <p className="text-xs text-muted-foreground">
                    {formData.grams_consumed}g of {formData.total_grams}g total @ ${formData.total_price}
                  </p>
                </div>
              </div>
            )}

            <Button
              className="w-full"
              onClick={handleLogMeal}
              disabled={!formData.item_name || formData.grams_consumed <= 0 || submitting}
              data-testid="log-meal-btn"
            >
              {submitting ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Plus className="w-4 h-4 mr-2" />
              )}
              Log Meal
            </Button>
          </CardContent>
        </Card>

        {/* Today's Log */}
        <Card className="border-border/50 rounded-2xl lg:col-span-2" data-testid="daily-log-card">
          <CardHeader>
            <CardTitle className="font-outfit flex items-center gap-2">
              <UtensilsCrossed className="w-5 h-5" />
              {format(selectedDate, 'EEEE, MMMM d')}
            </CardTitle>
            <CardDescription>
              {dailyData?.meal_count || 0} meals logged
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3].map(i => <Skeleton key={i} className="h-16 rounded-xl" />)}
              </div>
            ) : dailyData?.entries.length === 0 ? (
              <div className="text-center py-12">
                <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-4">
                  <UtensilsCrossed className="w-8 h-8 text-muted-foreground" />
                </div>
                <h3 className="font-outfit font-semibold text-lg mb-2">No meals logged</h3>
                <p className="text-muted-foreground text-sm">
                  Start tracking your meals using the form on the left
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {dailyData?.entries.map((entry) => (
                  <div
                    key={entry.id}
                    className="flex items-center justify-between p-4 rounded-xl bg-muted/50 hover:bg-muted/70 transition-colors group"
                    data-testid={`meal-entry-${entry.id}`}
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-medium">{entry.item_name}</p>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                          {entry.source}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {entry.grams_consumed}g serving • {format(new Date(entry.timestamp), 'h:mm a')}
                      </p>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="font-mono text-sm font-bold text-primary">{entry.calories_consumed} cal</p>
                        <p className="font-mono text-sm text-accent">${entry.cost.toFixed(2)}</p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDeleteEntry(entry.id)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive"
                        data-testid={`delete-entry-${entry.id}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
