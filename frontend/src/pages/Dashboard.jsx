import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Skeleton } from '../components/ui/skeleton';
import { API } from '../lib/api';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../components/ui/alert-dialog';
import { 
  PlusCircle, 
  Receipt, 
  TrendingUp, 
  DollarSign,
  Flame,
  Trash2,
  Eye,
  History
} from 'lucide-react';

export default function Dashboard() {
  const [analyses, setAnalyses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deleteId, setDeleteId] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    fetchAnalyses();
  }, []);

  const fetchAnalyses = async () => {
    try {
      const response = await axios.get(`${API}/analysis`);
      setAnalyses(response.data);
    } catch (error) {
      toast.error('Failed to load analysis history');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await axios.delete(`${API}/analysis/${deleteId}`);
      setAnalyses(prev => prev.filter(a => a.id !== deleteId));
      toast.success('Analysis deleted');
    } catch (error) {
      toast.error('Failed to delete analysis');
    } finally {
      setDeleteId(null);
    }
  };

  // Calculate summary stats
  const totalAnalyses = analyses.length;
  const avgCaloriesPerDollar = totalAnalyses > 0 
    ? Math.round(analyses.reduce((sum, a) => sum + a.avg_calories_per_dollar, 0) / totalAnalyses)
    : 0;
  const totalSpent = analyses.reduce((sum, a) => sum + a.total_cost, 0);

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-8 py-8" data-testid="dashboard-page">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
        <div>
          <h1 className="font-outfit font-bold text-3xl md:text-4xl tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground font-inter mt-1">Track your nutrition spending efficiency</p>
        </div>
        <Link to="/analyze" data-testid="new-analysis-btn">
          <Button className="rounded-full px-6 font-outfit">
            <PlusCircle className="w-4 h-4 mr-2" />
            New Analysis
          </Button>
        </Link>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <Card className="border-border/50 rounded-2xl" data-testid="stat-analyses">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                <Receipt className="w-6 h-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground font-inter">Total Analyses</p>
                <p className="font-mono text-2xl font-bold">{totalAnalyses}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/50 rounded-2xl" data-testid="stat-avg-cpd">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-emerald-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground font-inter">Avg Cal/$</p>
                <p className="font-mono text-2xl font-bold text-emerald-500">{avgCaloriesPerDollar}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/50 rounded-2xl" data-testid="stat-total-spent">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center">
                <DollarSign className="w-6 h-6 text-accent" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground font-inter">Total Tracked</p>
                <p className="font-mono text-2xl font-bold">${totalSpent.toFixed(2)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Analysis History */}
      <Card className="border-border/50 rounded-2xl">
        <CardHeader className="pb-4">
          <CardTitle className="font-outfit flex items-center gap-2">
            <History className="w-5 h-5" />
            Analysis History
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-4">
              {[1, 2, 3].map(i => (
                <Skeleton key={i} className="h-20 rounded-xl" />
              ))}
            </div>
          ) : analyses.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-4">
                <Receipt className="w-8 h-8 text-muted-foreground" />
              </div>
              <h3 className="font-outfit font-semibold text-lg mb-2">No analyses yet</h3>
              <p className="text-muted-foreground font-inter mb-6">
                Upload your first grocery receipt to get started
              </p>
              <Link to="/analyze" data-testid="empty-state-cta">
                <Button className="rounded-full">
                  <PlusCircle className="w-4 h-4 mr-2" />
                  Analyze Receipt
                </Button>
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {analyses.map((analysis) => (
                <div
                  key={analysis.id}
                  className="flex items-center justify-between p-4 rounded-xl bg-muted/50 hover:bg-muted/70 transition-colors group"
                  data-testid={`analysis-item-${analysis.id}`}
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                      <Flame className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-outfit font-medium">
                        {analysis.item_count} items analyzed
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {format(new Date(analysis.created_at), 'MMM d, yyyy • h:mm a')}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-6">
                    <div className="text-right hidden sm:block">
                      <p className="font-mono text-lg font-bold text-primary">
                        {Math.round(analysis.avg_calories_per_dollar)} cal/$
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {analysis.total_calories.toLocaleString()} cal • ${analysis.total_cost.toFixed(2)}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => navigate(`/analysis/${analysis.id}`)}
                        data-testid={`view-analysis-${analysis.id}`}
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setDeleteId(analysis.id)}
                        className="text-destructive hover:text-destructive"
                        data-testid={`delete-analysis-${analysis.id}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-outfit">Delete Analysis?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete this analysis from your history.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="cancel-delete">Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="confirm-delete"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
