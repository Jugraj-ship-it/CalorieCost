import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isToday, isSameDay } from 'date-fns';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Skeleton } from '../components/ui/skeleton';
import { 
  ChevronLeft, 
  ChevronRight,
  Flame,
  DollarSign,
  CalendarDays,
  TrendingUp
} from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function CalendarView() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [calendarData, setCalendarData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState(null);
  const [dayDetails, setDayDetails] = useState(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    fetchCalendarData();
  }, [currentDate]);

  const fetchCalendarData = async () => {
    setLoading(true);
    try {
      const month = currentDate.getMonth() + 1;
      const year = currentDate.getFullYear();
      const response = await axios.get(`${API}/meals/calendar?month=${month}&year=${year}`);
      setCalendarData(response.data);
    } catch (error) {
      toast.error('Failed to load calendar data');
    } finally {
      setLoading(false);
    }
  };

  const fetchDayDetails = async (date) => {
    setLoadingDetails(true);
    try {
      const dateStr = format(date, 'yyyy-MM-dd');
      const response = await axios.get(`${API}/meals/date/${dateStr}`);
      setDayDetails(response.data);
    } catch (error) {
      toast.error('Failed to load day details');
    } finally {
      setLoadingDetails(false);
    }
  };

  const handleDayClick = (day) => {
    setSelectedDay(day);
    fetchDayDetails(day);
  };

  const handlePrevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
    setSelectedDay(null);
    setDayDetails(null);
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
    setSelectedDay(null);
    setDayDetails(null);
  };

  const goToTracker = (date) => {
    // Navigate to tracker with date parameter
    navigate(`/track?date=${format(date, 'yyyy-MM-dd')}`);
  };

  // Generate calendar days
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const calendarDays = eachDayOfInterval({ start: monthStart, end: monthEnd });

  // Pad start of month
  const startDay = monthStart.getDay();
  const paddedDays = Array(startDay).fill(null).concat(calendarDays);

  // Create data lookup
  const dataByDate = {};
  calendarData?.days?.forEach(day => {
    dataByDate[day.date] = day;
  });

  // Get max values for color intensity
  const maxCalories = Math.max(...(calendarData?.days?.map(d => d.total_calories) || [1]));
  const maxCost = Math.max(...(calendarData?.days?.map(d => d.total_cost) || [1]));

  const getIntensity = (value, max) => {
    if (!value || !max) return 0;
    return Math.min(value / max, 1);
  };

  return (
    <div className="max-w-6xl mx-auto px-4 md:px-8 py-8" data-testid="calendar-page">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
        <div>
          <h1 className="font-outfit font-bold text-3xl md:text-4xl tracking-tight">Calendar</h1>
          <p className="text-muted-foreground font-inter mt-1">View your monthly intake and spending</p>
        </div>
        <Button onClick={() => navigate('/track')} className="font-outfit" data-testid="go-to-tracker">
          <CalendarDays className="w-4 h-4 mr-2" />
          Go to Tracker
        </Button>
      </div>

      {/* Monthly Stats */}
      {calendarData && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <Card className="border-border/50 rounded-2xl">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Flame className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Monthly Calories</p>
                  <p className="font-mono text-2xl font-bold">{calendarData.monthly_totals.total_calories.toLocaleString()}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/50 rounded-2xl">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center">
                  <DollarSign className="w-6 h-6 text-accent" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Monthly Spending</p>
                  <p className="font-mono text-2xl font-bold">${calendarData.monthly_totals.total_cost.toFixed(2)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/50 rounded-2xl">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center">
                  <TrendingUp className="w-6 h-6 text-blue-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Days Tracked</p>
                  <p className="font-mono text-2xl font-bold">{calendarData.monthly_totals.days_logged}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Calendar Grid */}
        <Card className="border-border/50 rounded-2xl lg:col-span-2" data-testid="calendar-card">
          <CardHeader>
            <div className="flex items-center justify-between">
              <Button variant="ghost" size="icon" onClick={handlePrevMonth} data-testid="prev-month">
                <ChevronLeft className="w-5 h-5" />
              </Button>
              <CardTitle className="font-outfit text-xl">
                {format(currentDate, 'MMMM yyyy')}
              </CardTitle>
              <Button variant="ghost" size="icon" onClick={handleNextMonth} data-testid="next-month">
                <ChevronRight className="w-5 h-5" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-80 rounded-xl" />
            ) : (
              <>
                {/* Day headers */}
                <div className="grid grid-cols-7 gap-1 mb-2">
                  {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                    <div key={day} className="text-center text-xs font-medium text-muted-foreground py-2">
                      {day}
                    </div>
                  ))}
                </div>

                {/* Calendar grid */}
                <div className="grid grid-cols-7 gap-1">
                  {paddedDays.map((day, index) => {
                    if (!day) {
                      return <div key={`empty-${index}`} className="aspect-square" />;
                    }

                    const dateStr = format(day, 'yyyy-MM-dd');
                    const dayData = dataByDate[dateStr];
                    const isSelected = selectedDay && isSameDay(day, selectedDay);
                    const intensity = dayData ? getIntensity(dayData.total_calories, maxCalories) : 0;

                    return (
                      <button
                        key={dateStr}
                        onClick={() => handleDayClick(day)}
                        className={`aspect-square rounded-lg p-1 transition-all relative ${
                          isToday(day) ? 'ring-2 ring-primary' : ''
                        } ${
                          isSelected ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'
                        } ${
                          !isSameMonth(day, currentDate) ? 'opacity-30' : ''
                        }`}
                        data-testid={`day-${dateStr}`}
                      >
                        <div className="text-sm font-medium">{format(day, 'd')}</div>
                        {dayData && !isSelected && (
                          <div 
                            className="absolute bottom-1 left-1 right-1 h-1 rounded-full bg-primary"
                            style={{ opacity: 0.3 + intensity * 0.7 }}
                          />
                        )}
                        {dayData && (
                          <div className={`text-[10px] ${isSelected ? 'text-primary-foreground/80' : 'text-muted-foreground'}`}>
                            {dayData.meal_count}
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Legend */}
                <div className="flex items-center justify-center gap-4 mt-4 pt-4 border-t border-border/50">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <div className="w-3 h-3 rounded bg-primary/30" />
                    <span>Low activity</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <div className="w-3 h-3 rounded bg-primary" />
                    <span>High activity</span>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Day Details */}
        <Card className="border-border/50 rounded-2xl" data-testid="day-details-card">
          <CardHeader>
            <CardTitle className="font-outfit">
              {selectedDay ? format(selectedDay, 'EEEE, MMM d') : 'Select a Day'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!selectedDay ? (
              <div className="text-center py-8 text-muted-foreground">
                <CalendarDays className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>Click on a day to see details</p>
              </div>
            ) : loadingDetails ? (
              <div className="space-y-3">
                <Skeleton className="h-20 rounded-xl" />
                <Skeleton className="h-16 rounded-xl" />
                <Skeleton className="h-16 rounded-xl" />
              </div>
            ) : dayDetails ? (
              <div className="space-y-4">
                {/* Day Summary */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-4 rounded-xl bg-primary/10">
                    <p className="text-xs text-muted-foreground mb-1">Calories</p>
                    <p className="font-mono text-xl font-bold text-primary">{dayDetails.total_calories}</p>
                  </div>
                  <div className="p-4 rounded-xl bg-accent/10">
                    <p className="text-xs text-muted-foreground mb-1">Cost</p>
                    <p className="font-mono text-xl font-bold text-accent">${dayDetails.total_cost.toFixed(2)}</p>
                  </div>
                </div>

                {/* Meals List */}
                {dayDetails.entries.length === 0 ? (
                  <div className="text-center py-6">
                    <p className="text-muted-foreground text-sm">No meals logged this day</p>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="mt-3"
                      onClick={() => goToTracker(selectedDay)}
                    >
                      Log a meal
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-60 overflow-auto">
                    {dayDetails.entries.map((entry) => (
                      <div
                        key={entry.id}
                        className="p-3 rounded-lg bg-muted/50"
                      >
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="font-medium text-sm">{entry.item_name}</p>
                            <p className="text-xs text-muted-foreground">
                              {format(new Date(entry.timestamp), 'h:mm a')}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="font-mono text-sm text-primary">{entry.calories_consumed} cal</p>
                            <p className="font-mono text-xs text-accent">${entry.cost.toFixed(2)}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Action Button */}
                <Button 
                  className="w-full"
                  onClick={() => goToTracker(selectedDay)}
                  data-testid="edit-day-btn"
                >
                  {dayDetails.entries.length > 0 ? 'Edit This Day' : 'Log Meals'}
                </Button>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
