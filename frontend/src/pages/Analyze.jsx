import { useState, useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Textarea } from '../components/ui/textarea';
import { Input } from '../components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '../components/ui/tabs';
import { API } from '../lib/api';
import { 
  Camera, 
  FileText, 
  Upload, 
  Loader2, 
  X,
  Sparkles,
  Pencil,
  Trash2,
  Check,
  ArrowLeft,
  Plus,
  Search
} from 'lucide-react';

// Autocomplete Input Component
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
      console.error('Search error:', error);
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
          className="font-medium pr-8"
          data-testid="food-autocomplete-input"
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
              data-testid={`suggestion-${index}`}
            >
              <div>
                <p className="font-medium text-sm">{item.name}</p>
                <p className="text-xs text-muted-foreground">{item.quantity}</p>
              </div>
              <div className="text-right">
                <p className="font-mono text-sm text-primary font-semibold">{item.calories} cal</p>
                <p className="text-xs text-muted-foreground">{item.calories_per_unit} cal/{item.unit}</p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default function Analyze() {
  const [activeTab, setActiveTab] = useState('upload');
  const [receiptText, setReceiptText] = useState('');
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [extractedItems, setExtractedItems] = useState(null);
  const [editingIndex, setEditingIndex] = useState(null);
  const [showAddItem, setShowAddItem] = useState(false);
  const [newItem, setNewItem] = useState({ name: '', calories: 0, price: 0, quantity: '' });
  const navigate = useNavigate();

  const handleDrag = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  }, []);

  const handleFile = (file) => {
    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast.error('File size must be less than 10MB');
      return;
    }

    setImageFile(file);
    const reader = new FileReader();
    reader.onload = (e) => setImagePreview(e.target.result);
    reader.readAsDataURL(file);
  };

  const handleFileInput = (e) => {
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  };

  const clearImage = () => {
    setImageFile(null);
    setImagePreview(null);
    setExtractedItems(null);
  };

  const convertToBase64 = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result);
      reader.onerror = error => reject(error);
    });
  };

  // Extract items from image (step 1)
  const handleExtract = async () => {
    if (!imageFile) {
      toast.error('Please upload a receipt image');
      return;
    }

    setLoading(true);
    try {
      const base64 = await convertToBase64(imageFile);
      const response = await axios.post(`${API}/extract`, {
        receipt_image_base64: base64
      });
      setExtractedItems(response.data.items);
      toast.success(`Extracted ${response.data.items.length} items! Review and edit if needed.`);
    } catch (error) {
      const message = error.response?.data?.detail || 'Extraction failed. Please try again.';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  // Handle item edit
  const handleItemChange = (index, field, value) => {
    const updated = [...extractedItems];
    if (field === 'calories' || field === 'price') {
      updated[index][field] = parseFloat(value) || 0;
    } else {
      updated[index][field] = value;
    }
    setExtractedItems(updated);
  };

  // Handle autocomplete selection in edit mode
  const handleEditAutocompleteSelect = (index, item) => {
    const updated = [...extractedItems];
    updated[index] = {
      ...updated[index],
      name: item.name,
      calories: item.calories,
      quantity: item.quantity
    };
    setExtractedItems(updated);
  };

  // Handle item delete
  const handleDeleteItem = (index) => {
    const updated = extractedItems.filter((_, i) => i !== index);
    setExtractedItems(updated);
    if (updated.length === 0) {
      setExtractedItems(null);
      toast.info('All items removed. Upload a new receipt or add items manually.');
    }
  };

  // Add new item manually
  const handleAddItem = () => {
    if (!newItem.name || newItem.price <= 0) {
      toast.error('Please enter item name and price');
      return;
    }
    
    const itemToAdd = {
      ...newItem,
      calories: newItem.calories || 100
    };
    
    if (extractedItems) {
      setExtractedItems([...extractedItems, itemToAdd]);
    } else {
      setExtractedItems([itemToAdd]);
    }
    
    setNewItem({ name: '', calories: 0, price: 0, quantity: '' });
    setShowAddItem(false);
    toast.success('Item added');
  };

  // Handle autocomplete selection for new item
  const handleNewItemAutocompleteSelect = (item) => {
    setNewItem({
      ...newItem,
      name: item.name,
      calories: item.calories,
      quantity: item.quantity
    });
  };

  // Submit edited items for final analysis
  const handleSubmitItems = async () => {
    if (!extractedItems || extractedItems.length === 0) {
      toast.error('No items to analyze');
      return;
    }

    setLoading(true);
    try {
      const response = await axios.post(`${API}/analysis/from-items`, {
        items: extractedItems
      });
      toast.success('Analysis complete!');
      navigate(`/analysis/${response.data.id}`);
    } catch (error) {
      const message = error.response?.data?.detail || 'Analysis failed. Please try again.';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  // Direct analysis for text input
  const handleAnalyzeText = async () => {
    if (!receiptText.trim()) {
      toast.error('Please enter receipt text');
      return;
    }

    setLoading(true);
    try {
      const response = await axios.post(`${API}/analysis`, {
        receipt_text: receiptText
      });
      toast.success('Analysis complete!');
      navigate(`/analysis/${response.data.id}`);
    } catch (error) {
      const message = error.response?.data?.detail || 'Analysis failed. Please try again.';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const sampleReceipt = `GROCERY MART
Date: 01/15/2024

Large Eggs 12ct          $3.49
Whole Milk 1 gallon      $4.29
White Bread              $2.99
Chicken Breast 2lb       $8.99
Rice 5lb bag             $6.99
Bananas 1 bunch          $1.49
Cheddar Cheese 8oz       $4.49
Ground Beef 1lb          $5.99
Pasta 1lb box            $1.79
Orange Juice 64oz        $3.99

Subtotal: $44.46
Tax: $0.00
Total: $44.46`;

  // Reset to upload state
  const handleBackToUpload = () => {
    setExtractedItems(null);
    setEditingIndex(null);
    setShowAddItem(false);
  };

  return (
    <div className="max-w-4xl mx-auto px-4 md:px-8 py-8" data-testid="analyze-page">
      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="font-outfit font-bold text-3xl md:text-4xl tracking-tight mb-2">
          Analyze Receipt
        </h1>
        <p className="text-muted-foreground font-inter">
          {extractedItems 
            ? "Review and edit extracted items before analysis"
            : "Upload an image or paste your receipt text to calculate calories per dollar"
          }
        </p>
      </div>

      {/* Main Card */}
      <Card className="border-border/50 rounded-2xl shadow-lg">
        {/* Show extracted items for editing */}
        {extractedItems ? (
          <>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleBackToUpload}
                    data-testid="back-to-upload"
                  >
                    <ArrowLeft className="w-5 h-5" />
                  </Button>
                  <div>
                    <CardTitle className="font-outfit">Review Extracted Items</CardTitle>
                    <CardDescription>
                      {extractedItems.length} items found. Click to edit or delete items.
                    </CardDescription>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowAddItem(true)}
                  data-testid="add-item-btn"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Item
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {/* Add New Item Form */}
              {showAddItem && (
                <div className="mb-4 p-4 rounded-xl bg-primary/5 border border-primary/20">
                  <p className="font-outfit font-medium text-sm mb-3">Add New Item</p>
                  <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                    <div className="md:col-span-2">
                      <FoodAutocomplete
                        value={newItem.name}
                        onChange={(val) => setNewItem({ ...newItem, name: val })}
                        onSelect={handleNewItemAutocompleteSelect}
                        placeholder="Search or type item name..."
                      />
                    </div>
                    <Input
                      type="number"
                      value={newItem.calories || ''}
                      onChange={(e) => setNewItem({ ...newItem, calories: parseInt(e.target.value) || 0 })}
                      placeholder="Calories"
                      className="font-mono"
                      data-testid="new-item-calories"
                    />
                    <Input
                      type="number"
                      step="0.01"
                      value={newItem.price || ''}
                      onChange={(e) => setNewItem({ ...newItem, price: parseFloat(e.target.value) || 0 })}
                      placeholder="Price ($)"
                      className="font-mono"
                      data-testid="new-item-price"
                    />
                    <div className="flex gap-2">
                      <Button onClick={handleAddItem} size="sm" className="flex-1" data-testid="confirm-add-item">
                        <Check className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => setShowAddItem(false)} data-testid="cancel-add-item">
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                  <Input
                    value={newItem.quantity}
                    onChange={(e) => setNewItem({ ...newItem, quantity: e.target.value })}
                    placeholder="Quantity (e.g., 12 eggs, 1 gallon)"
                    className="mt-2"
                    data-testid="new-item-quantity"
                  />
                </div>
              )}

              <div className="space-y-3 mb-6">
                {extractedItems.map((item, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-4 p-4 rounded-xl bg-muted/50 hover:bg-muted/70 transition-colors group"
                    data-testid={`extracted-item-${index}`}
                  >
                    {editingIndex === index ? (
                      // Edit mode
                      <div className="flex-1 space-y-3">
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                          <div className="md:col-span-1">
                            <FoodAutocomplete
                              value={item.name}
                              onChange={(val) => handleItemChange(index, 'name', val)}
                              onSelect={(selected) => handleEditAutocompleteSelect(index, selected)}
                              placeholder="Item name"
                            />
                          </div>
                          <Input
                            type="number"
                            value={item.calories}
                            onChange={(e) => handleItemChange(index, 'calories', e.target.value)}
                            placeholder="Calories"
                            className="font-mono"
                            data-testid={`edit-calories-${index}`}
                          />
                          <Input
                            type="number"
                            step="0.01"
                            value={item.price}
                            onChange={(e) => handleItemChange(index, 'price', e.target.value)}
                            placeholder="Price"
                            className="font-mono"
                            data-testid={`edit-price-${index}`}
                          />
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setEditingIndex(null)}
                            className="w-full md:w-auto"
                            data-testid={`save-edit-${index}`}
                          >
                            <Check className="w-4 h-4 mr-2" />
                            Done
                          </Button>
                        </div>
                        <Input
                          value={item.quantity || ''}
                          onChange={(e) => handleItemChange(index, 'quantity', e.target.value)}
                          placeholder="Quantity (e.g., 12 eggs, 1 gallon)"
                          className="w-full"
                          data-testid={`edit-quantity-${index}`}
                        />
                      </div>
                    ) : (
                      // View mode
                      <>
                        <div className="flex-1">
                          <p className="font-medium">{item.name}</p>
                          {item.quantity && (
                            <p className="text-xs text-muted-foreground">{item.quantity}</p>
                          )}
                        </div>
                        <div className="text-right">
                          <p className="font-mono text-sm">{item.calories} cal</p>
                          <p className="font-mono text-sm text-muted-foreground">${item.price.toFixed(2)}</p>
                        </div>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setEditingIndex(index)}
                            data-testid={`edit-item-${index}`}
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeleteItem(index)}
                            className="text-destructive hover:text-destructive"
                            data-testid={`delete-item-${index}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>

              {/* Submit Button */}
              <Button
                className="w-full h-14 rounded-xl font-outfit font-bold text-lg"
                onClick={handleSubmitItems}
                disabled={loading || extractedItems.length === 0}
                data-testid="submit-items-btn"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Analyzing...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-5 h-5 mr-2" />
                    Confirm & Analyze ({extractedItems.length} items)
                  </>
                )}
              </Button>
            </CardContent>
          </>
        ) : (
          // Upload/Text input view
          <>
            <CardHeader>
              <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="grid w-full grid-cols-2 h-12 rounded-xl">
                  <TabsTrigger 
                    value="upload" 
                    className="rounded-lg font-outfit data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                    data-testid="tab-upload"
                  >
                    <Camera className="w-4 h-4 mr-2" />
                    Image Upload
                  </TabsTrigger>
                  <TabsTrigger 
                    value="text"
                    className="rounded-lg font-outfit data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                    data-testid="tab-text"
                  >
                    <FileText className="w-4 h-4 mr-2" />
                    Manual Entry
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </CardHeader>

            <CardContent className="pt-0">
              {activeTab === 'upload' ? (
                <div className="space-y-6">
                  {/* Dropzone */}
                  {!imagePreview ? (
                    <div
                      className={`dropzone ${dragActive ? 'border-primary bg-primary/10' : ''}`}
                      onDragEnter={handleDrag}
                      onDragLeave={handleDrag}
                      onDragOver={handleDrag}
                      onDrop={handleDrop}
                      onClick={() => document.getElementById('file-input').click()}
                      data-testid="dropzone"
                    >
                      <input
                        id="file-input"
                        type="file"
                        accept="image/*"
                        onChange={handleFileInput}
                        className="hidden"
                        data-testid="file-input"
                      />
                      <div className="dropzone-icon text-primary/50 transition-all duration-300">
                        <Upload className="w-16 h-16 mx-auto mb-4" />
                      </div>
                      <h3 className="font-outfit font-semibold text-lg mb-2">
                        Drop your receipt here
                      </h3>
                      <p className="text-muted-foreground text-sm mb-4">
                        or click to browse files
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Supports JPG, PNG, WEBP • Max 10MB
                      </p>
                    </div>
                  ) : (
                    <div className="relative rounded-2xl overflow-hidden bg-muted/30">
                      <img
                        src={imagePreview}
                        alt="Receipt preview"
                        className="w-full max-h-[400px] object-contain mx-auto"
                        data-testid="image-preview"
                      />
                      <Button
                        variant="destructive"
                        size="icon"
                        className="absolute top-4 right-4 rounded-full"
                        onClick={clearImage}
                        data-testid="clear-image"
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  )}

                  {/* Extract Button for images */}
                  <Button
                    className="w-full h-14 rounded-xl font-outfit font-bold text-lg"
                    onClick={handleExtract}
                    disabled={loading || !imageFile}
                    data-testid="extract-btn"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                        Extracting items...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-5 h-5 mr-2" />
                        Extract Items from Receipt
                      </>
                    )}
                  </Button>

                  <p className="text-center text-sm text-muted-foreground">
                    Items will be extracted for you to review and edit before analysis
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <CardDescription>
                      Paste or type your receipt items with prices
                    </CardDescription>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setReceiptText(sampleReceipt)}
                      data-testid="load-sample"
                    >
                      <Sparkles className="w-4 h-4 mr-2" />
                      Load Sample
                    </Button>
                  </div>
                  <Textarea
                    placeholder={`Enter receipt items with prices, e.g.:
Eggs 12ct - $3.49
Milk 1 gallon - $4.29
Bread - $2.99
Chicken 2lb - $8.99`}
                    value={receiptText}
                    onChange={(e) => setReceiptText(e.target.value)}
                    className="min-h-[300px] font-mono text-sm rounded-xl"
                    data-testid="receipt-text"
                  />

                  {/* Analyze Button for text */}
                  <Button
                    className="w-full h-14 rounded-xl font-outfit font-bold text-lg"
                    onClick={handleAnalyzeText}
                    disabled={loading || !receiptText.trim()}
                    data-testid="analyze-text-btn"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                        Analyzing...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-5 h-5 mr-2" />
                        Analyze Receipt
                      </>
                    )}
                  </Button>

                  <p className="text-center text-sm text-muted-foreground">
                    Our AI will extract items, estimate calories, and calculate value per dollar
                  </p>
                </div>
              )}
            </CardContent>
          </>
        )}
      </Card>
    </div>
  );
}
