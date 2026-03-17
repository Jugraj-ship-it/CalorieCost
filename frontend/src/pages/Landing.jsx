import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';
import { 
  Receipt, 
  TrendingUp, 
  Zap, 
  BarChart3, 
  Camera,
  FileText,
  ArrowRight,
  CheckCircle2
} from 'lucide-react';

export default function Landing() {
  const { isAuthenticated } = useAuth();

  const features = [
    {
      icon: Camera,
      title: "Scan Receipts",
      description: "Upload receipt images and our AI extracts all food items automatically"
    },
    {
      icon: Zap,
      title: "Instant Analysis",
      description: "Get calorie estimates and cost efficiency metrics in seconds"
    },
    {
      icon: BarChart3,
      title: "Smart Rankings",
      description: "See which foods give you the most nutrition for your dollar"
    },
    {
      icon: TrendingUp,
      title: "Track History",
      description: "Save and compare your shopping trips over time"
    }
  ];

  const benefits = [
    "AI-powered calorie estimation",
    "Calories per dollar ranking",
    "Best & worst value insights",
    "Shopping history tracking",
    "Dark & light themes"
  ];

  return (
    <div className="min-h-screen" data-testid="landing-page">
      {/* Hero Section */}
      <section className="relative overflow-hidden">
        {/* Background Image */}
        <div 
          className="absolute inset-0 bg-cover bg-center opacity-10 dark:opacity-5"
          style={{ backgroundImage: 'url(https://images.unsplash.com/photo-1766228271606-f2d7bdbb9db3?crop=entropy&cs=srgb&fm=jpg&q=85)' }}
        />
        
        <div className="relative max-w-7xl mx-auto px-4 md:px-8 py-20 md:py-32">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            {/* Left Content */}
            <div className="space-y-8 animate-slide-in">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20">
                <Zap className="w-4 h-4 text-primary" />
                <span className="text-sm font-medium text-primary">AI-Powered Analysis</span>
              </div>
              
              <h1 className="font-outfit font-extrabold text-5xl md:text-7xl tracking-tight leading-none">
                Stop Guessing.
                <span className="block gradient-text">Start Saving.</span>
              </h1>
              
              <p className="font-inter text-lg md:text-xl text-muted-foreground max-w-lg leading-relaxed">
                Upload your grocery receipts and discover which foods give you the most 
                nutritional value for your money. Optimize your budget and health.
              </p>
              
              <div className="flex flex-col sm:flex-row gap-4">
                <Link to={isAuthenticated ? "/analyze" : "/register"} data-testid="hero-cta">
                  <Button size="lg" className="rounded-full px-8 py-6 font-outfit font-bold tracking-wide shadow-lg hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
                    {isAuthenticated ? "Analyze Receipt" : "Get Started Free"}
                    <ArrowRight className="w-5 h-5 ml-2" />
                  </Button>
                </Link>
                <Link to={isAuthenticated ? "/dashboard" : "/login"} data-testid="hero-secondary">
                  <Button variant="outline" size="lg" className="rounded-full px-8 py-6 font-outfit font-medium">
                    {isAuthenticated ? "View Dashboard" : "Login"}
                  </Button>
                </Link>
              </div>

              {/* Quick Benefits */}
              <div className="flex flex-wrap gap-3 pt-4">
                {benefits.slice(0, 3).map((benefit, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm text-muted-foreground">
                    <CheckCircle2 className="w-4 h-4 text-primary" />
                    {benefit}
                  </div>
                ))}
              </div>
            </div>

            {/* Right Content - Hero Card */}
            <div className="relative animate-fade-in" style={{ animationDelay: '0.3s' }}>
              <div className="relative">
                <Card className="bg-card border border-border/50 shadow-2xl rounded-3xl overflow-hidden">
                  <CardContent className="p-8">
                    {/* Sample Analysis Preview */}
                    <div className="space-y-6">
                      <div className="flex items-center justify-between">
                        <h3 className="font-outfit font-semibold text-lg">Today's Analysis</h3>
                        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Sample</span>
                      </div>
                      
                      {/* Stats Row */}
                      <div className="grid grid-cols-3 gap-4">
                        <div className="text-center p-4 rounded-2xl bg-primary/10">
                          <p className="font-mono text-2xl font-bold text-primary">4,250</p>
                          <p className="text-xs text-muted-foreground mt-1">Total Cal</p>
                        </div>
                        <div className="text-center p-4 rounded-2xl bg-accent/10">
                          <p className="font-mono text-2xl font-bold text-accent">$32.50</p>
                          <p className="text-xs text-muted-foreground mt-1">Total Cost</p>
                        </div>
                        <div className="text-center p-4 rounded-2xl bg-emerald-500/10">
                          <p className="font-mono text-2xl font-bold text-emerald-500">131</p>
                          <p className="text-xs text-muted-foreground mt-1">Cal/$</p>
                        </div>
                      </div>

                      {/* Sample Items */}
                      <div className="space-y-3">
                        <div className="flex items-center justify-between p-3 rounded-xl bg-muted/50">
                          <span className="font-medium">Eggs (12ct)</span>
                          <span className="font-mono text-primary font-bold">280 cal/$</span>
                        </div>
                        <div className="flex items-center justify-between p-3 rounded-xl bg-muted/50">
                          <span className="font-medium">Rice (2lb)</span>
                          <span className="font-mono text-primary font-bold">267 cal/$</span>
                        </div>
                        <div className="flex items-center justify-between p-3 rounded-xl bg-muted/50">
                          <span className="font-medium">Bread</span>
                          <span className="font-mono text-primary font-bold">200 cal/$</span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Floating Elements */}
                <div className="absolute -top-4 -right-4 w-20 h-20 rounded-2xl bg-primary/20 backdrop-blur-xl flex items-center justify-center animate-pulse-glow">
                  <Receipt className="w-8 h-8 text-primary" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 bg-muted/30">
        <div className="max-w-7xl mx-auto px-4 md:px-8">
          <div className="text-center mb-16 stagger-children">
            <h2 className="font-outfit font-bold text-3xl md:text-5xl tracking-tight mb-4">
              How It Works
            </h2>
            <p className="font-inter text-lg text-muted-foreground max-w-2xl mx-auto">
              Transform your grocery receipts into actionable nutrition insights in just a few steps
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 stagger-children">
            {features.map((feature, index) => (
              <Card 
                key={index}
                className="bg-card border border-border/50 shadow-sm rounded-2xl hover:border-primary/20 hover:shadow-md transition-all duration-300 group"
                data-testid={`feature-card-${index}`}
              >
                <CardContent className="p-6">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                    <feature.icon className="w-6 h-6 text-primary" />
                  </div>
                  <h3 className="font-outfit font-semibold text-lg mb-2">{feature.title}</h3>
                  <p className="font-inter text-sm text-muted-foreground">{feature.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Input Methods Section */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4 md:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-6">
              <h2 className="font-outfit font-bold text-3xl md:text-5xl tracking-tight">
                Two Ways to Analyze
              </h2>
              <p className="font-inter text-lg text-muted-foreground">
                Whether you prefer snapping a photo or typing it out, we've got you covered
              </p>

              <div className="space-y-4">
                <Card className="border-primary/20 bg-primary/5">
                  <CardContent className="p-6 flex items-start gap-4">
                    <div className="w-12 h-12 rounded-xl bg-primary flex items-center justify-center shrink-0">
                      <Camera className="w-6 h-6 text-primary-foreground" />
                    </div>
                    <div>
                      <h4 className="font-outfit font-semibold mb-1">Image Upload</h4>
                      <p className="text-sm text-muted-foreground">
                        Upload a photo of your receipt and our AI will extract all items and prices automatically
                      </p>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-accent/20 bg-accent/5">
                  <CardContent className="p-6 flex items-start gap-4">
                    <div className="w-12 h-12 rounded-xl bg-accent flex items-center justify-center shrink-0">
                      <FileText className="w-6 h-6 text-accent-foreground" />
                    </div>
                    <div>
                      <h4 className="font-outfit font-semibold mb-1">Manual Entry</h4>
                      <p className="text-sm text-muted-foreground">
                        Type or paste your receipt text for quick analysis when images aren't available
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>

            <div className="relative">
              <img 
                src="https://images.unsplash.com/photo-1661260518143-b64a9d980db4?crop=entropy&cs=srgb&fm=jpg&q=85"
                alt="Smart Shopping"
                className="rounded-3xl shadow-xl"
              />
              <div className="absolute -bottom-6 -left-6 glass rounded-2xl p-4 shadow-lg">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                    <TrendingUp className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-outfit font-semibold">Save 20%</p>
                    <p className="text-xs text-muted-foreground">on your grocery budget</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-primary/5">
        <div className="max-w-4xl mx-auto px-4 md:px-8 text-center">
          <h2 className="font-outfit font-bold text-3xl md:text-5xl tracking-tight mb-6">
            Start Optimizing Your Nutrition Budget
          </h2>
          <p className="font-inter text-lg text-muted-foreground mb-8 max-w-2xl mx-auto">
            Join thousands of smart shoppers who are getting more nutrition for their money
          </p>
          <Link to={isAuthenticated ? "/analyze" : "/register"} data-testid="cta-bottom">
            <Button size="lg" className="rounded-full px-10 py-6 font-outfit font-bold tracking-wide shadow-lg hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
              {isAuthenticated ? "Start New Analysis" : "Create Free Account"}
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
          </Link>
        </div>
      </section>
    </div>
  );
}
