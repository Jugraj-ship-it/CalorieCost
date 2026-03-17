import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Skeleton } from '../components/ui/skeleton';
import { Badge } from '../components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table';
import { 
  ArrowLeft, 
  Trophy, 
  TrendingUp,
  TrendingDown,
  Flame,
  DollarSign,
  Lightbulb,
  Download,
  Share2
} from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function AnalysisResult() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAnalysis();
  }, [id]);

  const fetchAnalysis = async () => {
    try {
      const response = await axios.get(`${API}/analysis/${id}`);
      setAnalysis(response.data);
    } catch (error) {
      toast.error('Analysis not found');
      navigate('/dashboard');
    } finally {
      setLoading(false);
    }
  };

  const getValueBadge = (cpd, avgCpd) => {
    if (cpd >= avgCpd * 1.5) return { label: 'Excellent', variant: 'default', color: 'bg-emerald-500' };
    if (cpd >= avgCpd) return { label: 'Good', variant: 'secondary', color: 'bg-blue-500' };
    if (cpd >= avgCpd * 0.5) return { label: 'Fair', variant: 'outline', color: 'bg-yellow-500' };
    return { label: 'Low', variant: 'destructive', color: 'bg-red-500' };
  };

  const handleExport = () => {
    if (!analysis) return;
    
    const content = `
NUTRITION COST ANALYSIS
Generated: ${format(new Date(analysis.created_at), 'PPpp')}

SUMMARY
-------
Total Calories: ${analysis.total_calories.toLocaleString()}
Total Cost: $${analysis.total_cost.toFixed(2)}
Average Cal/$: ${analysis.avg_calories_per_dollar.toFixed(0)}

ITEMS (Ranked by Calories/$)
----------------------------
${analysis.items.map((item, i) => 
  `${i + 1}. ${item.name}: ${item.calories} cal, $${item.price.toFixed(2)}, ${item.calories_per_dollar.toFixed(0)} cal/$`
).join('\n')}

BEST VALUE ITEMS
----------------
${analysis.best_value_items.join(', ')}

INSIGHTS
--------
${analysis.insights.join('\n')}
    `.trim();

    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `nutrition-analysis-${format(new Date(analysis.created_at), 'yyyy-MM-dd')}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Report downloaded');
  };

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto px-4 md:px-8 py-8">
        <Skeleton className="h-10 w-48 mb-8" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-32 rounded-2xl" />)}
        </div>
        <Skeleton className="h-96 rounded-2xl" />
      </div>
    );
  }

  if (!analysis) return null;

  return (
    <div className="max-w-6xl mx-auto px-4 md:px-8 py-8" data-testid="analysis-result-page">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
        <div className="flex items-center gap-4">
          <Button 
            variant="ghost" 
            size="icon"
            onClick={() => navigate('/dashboard')}
            data-testid="back-btn"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="font-outfit font-bold text-2xl md:text-3xl tracking-tight">
              Analysis Results
            </h1>
            <p className="text-muted-foreground text-sm font-inter">
              {format(new Date(analysis.created_at), 'MMMM d, yyyy • h:mm a')}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleExport} data-testid="export-btn">
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
          <Link to="/analyze">
            <Button size="sm" data-testid="new-analysis-btn">
              New Analysis
            </Button>
          </Link>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <Card className="border-border/50 rounded-2xl" data-testid="stat-total-cal">
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <Flame className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Total Cal</p>
                <p className="font-mono text-xl font-bold">{analysis.total_calories.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/50 rounded-2xl" data-testid="stat-total-cost">
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center">
                <DollarSign className="w-5 h-5 text-accent" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Total Cost</p>
                <p className="font-mono text-xl font-bold">${analysis.total_cost.toFixed(2)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/50 rounded-2xl bg-primary/5" data-testid="stat-avg-cpd">
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-primary-foreground" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Avg Cal/$</p>
                <p className="font-mono text-xl font-bold text-primary">
                  {analysis.avg_calories_per_dollar.toFixed(0)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/50 rounded-2xl" data-testid="stat-items">
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
                <Trophy className="w-5 h-5 text-blue-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Items</p>
                <p className="font-mono text-xl font-bold">{analysis.items.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Items Table */}
        <Card className="lg:col-span-2 border-border/50 rounded-2xl" data-testid="items-table-card">
          <CardHeader>
            <CardTitle className="font-outfit flex items-center gap-2">
              <Trophy className="w-5 h-5 text-primary" />
              Items Ranked by Value
            </CardTitle>
            <CardDescription>
              Sorted from highest to lowest calories per dollar
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-xl border border-border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50 hover:bg-muted/50">
                    <TableHead className="font-outfit text-xs uppercase tracking-wider">#</TableHead>
                    <TableHead className="font-outfit text-xs uppercase tracking-wider">Item</TableHead>
                    <TableHead className="font-outfit text-xs uppercase tracking-wider text-right">Calories</TableHead>
                    <TableHead className="font-outfit text-xs uppercase tracking-wider text-right">Price</TableHead>
                    <TableHead className="font-outfit text-xs uppercase tracking-wider text-right">Cal/$</TableHead>
                    <TableHead className="font-outfit text-xs uppercase tracking-wider">Value</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {analysis.items.map((item, index) => {
                    const badge = getValueBadge(item.calories_per_dollar, analysis.avg_calories_per_dollar);
                    const isTop3 = index < 3;
                    
                    return (
                      <TableRow 
                        key={index} 
                        className={isTop3 ? 'bg-primary/5' : ''}
                        data-testid={`item-row-${index}`}
                      >
                        <TableCell className="font-mono font-medium">
                          {isTop3 ? (
                            <span className="text-primary">{index + 1}</span>
                          ) : (
                            index + 1
                          )}
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">{item.name}</p>
                            {item.quantity && (
                              <p className="text-xs text-muted-foreground">{item.quantity}</p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-mono tabular-nums">
                          {item.calories.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right font-mono tabular-nums">
                          ${item.price.toFixed(2)}
                        </TableCell>
                        <TableCell className="text-right font-mono tabular-nums font-bold text-primary">
                          {item.calories_per_dollar.toFixed(0)}
                        </TableCell>
                        <TableCell>
                          <Badge variant={badge.variant} className="text-xs">
                            {badge.label}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Insights Panel */}
        <div className="space-y-6">
          {/* Best Value */}
          <Card className="border-border/50 rounded-2xl border-emerald-500/30 bg-emerald-500/5" data-testid="best-value-card">
            <CardHeader className="pb-3">
              <CardTitle className="font-outfit text-lg flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-emerald-500" />
                Best Value Foods
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {analysis.best_value_items.map((item, i) => (
                  <div 
                    key={i}
                    className="flex items-center gap-2 p-2 rounded-lg bg-emerald-500/10"
                  >
                    <span className="font-mono text-emerald-500 font-bold text-sm">
                      #{i + 1}
                    </span>
                    <span className="font-medium text-sm">{item}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Worst Value */}
          {analysis.worst_value_items.length > 0 && (
            <Card className="border-border/50 rounded-2xl border-orange-500/30 bg-orange-500/5" data-testid="worst-value-card">
              <CardHeader className="pb-3">
                <CardTitle className="font-outfit text-lg flex items-center gap-2">
                  <TrendingDown className="w-5 h-5 text-orange-500" />
                  Lower Value Foods
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {analysis.worst_value_items.map((item, i) => (
                    <div 
                      key={i}
                      className="flex items-center gap-2 p-2 rounded-lg bg-orange-500/10"
                    >
                      <span className="font-medium text-sm">{item}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Insights */}
          <Card className="border-border/50 rounded-2xl" data-testid="insights-card">
            <CardHeader className="pb-3">
              <CardTitle className="font-outfit text-lg flex items-center gap-2">
                <Lightbulb className="w-5 h-5 text-primary" />
                Insights
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {analysis.insights.map((insight, i) => (
                  <p key={i} className="text-sm text-muted-foreground leading-relaxed">
                    {insight}
                  </p>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
