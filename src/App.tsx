import React, { useState, useEffect, useCallback } from 'react';
import {
  Radar,
  Coffee,
  Sparkles,
  MapPin,
  ArrowRight,
  Star,
  Zap,
  Wifi,
  ChevronLeft,
  Share2,
  Bookmark,
  Map as MapIcon,
  List,
  Send
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { APIProvider, Map, AdvancedMarker, InfoWindow, Pin, useMapsLibrary, useMap } from '@vis.gl/react-google-maps';
import { GoogleGenAI } from "@google/genai";

// --- Auth / Key Config ---
const MAP_KEY =
  process.env.GOOGLE_MAPS_PLATFORM_KEY ||
  (import.meta as any).env?.VITE_GOOGLE_MAPS_KEY ||
  (globalThis as any).GOOGLE_MAPS_PLATFORM_KEY ||
  '';

const GEMINI_KEY =
  process.env.GEMINI_API_KEY ||
  (import.meta as any).env?.VITE_GEMINI_API_KEY ||
  '';

const hasValidKey = Boolean(MAP_KEY) && MAP_KEY !== 'YOUR_API_KEY';

const ai = new GoogleGenAI({ apiKey: GEMINI_KEY || 'MISSING_KEY' });

// --- Types ---
type Page = 'radar' | 'spots' | 'ai-finder' | 'detail' | 'saved';

interface Review {
  id: string;
  user: string;
  rating: number;
  comment: string;
  sentiment: 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL';
  date: string;
}

interface Spot {
  id: string;
  name: string;
  location: string;
  distance: string;
  vibe: string;
  rating: number;
  reviews: number;
  price: string;
  openUntil: string;
  imageUrl: string;
  imageUrls: string[];
  coordinates: { lat: number, lng: number };
  stats: {
    crowd: string;
    occupancy: number;
    wifi: string;
  };
  userReviews: Review[];
  googleReviews?: any[];
}

// --- Mock Data ---
const MOCK_SPOTS: Spot[] = [
  {
    id: '1',
    name: 'Kopi Brantas',
    location: 'Mojoroto, Kediri',
    distance: '1.2 km',
    vibe: '95% Quiet',
    rating: 4.8,
    reviews: 156,
    price: '$$',
    openUntil: '22:00',
    imageUrl: 'https://images.unsplash.com/photo-1501339817302-38203b9f9fef?auto=format&fit=crop&w=800&q=80',
    imageUrls: ['https://images.unsplash.com/photo-1501339817302-38203b9f9fef?auto=format&fit=crop&w=800&q=80'],
    coordinates: { lat: -7.8185, lng: 112.0005 },
    stats: { crowd: 'Quiet', occupancy: 15, wifi: '450 Mbps' },
    userReviews: [
      { id: 'r1', user: 'LOCAL_HERO', rating: 5, comment: 'Vibe pinggir sungai yang mantap.', sentiment: 'POSITIVE', date: '2024-05-01' }
    ]
  },
  {
    id: '2',
    name: 'Kedai Simpang Lima',
    location: 'Gumul, Kediri',
    distance: '4.5 km',
    vibe: 'Busy',
    rating: 4.6,
    reviews: 210,
    price: '$',
    openUntil: '21:00',
    imageUrl: 'https://images.unsplash.com/photo-1554118811-1e0d58224f24?auto=format&fit=crop&w=800&q=80',
    imageUrls: ['https://images.unsplash.com/photo-1554118811-1e0d58224f24?auto=format&fit=crop&w=800&q=80'],
    coordinates: { lat: -7.8285, lng: 112.0725 },
    stats: { crowd: 'Medium', occupancy: 65, wifi: '200 Mbps' },
    userReviews: []
  }
];


// --- AI Functions ---
async function analyzeSentiment(text: string): Promise<'POSITIVE' | 'NEGATIVE' | 'NEUTRAL'> {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-1.5-flash",
      contents: `Analyze the sentiment of this coffee shop review. Return ONLY one of these three words: POSITIVE, NEGATIVE, or NEUTRAL.

  Review: "${text}"`
    });
    const sentiment = response.text.trim().toUpperCase();
    if (['POSITIVE', 'NEGATIVE', 'NEUTRAL'].includes(sentiment)) {
      return sentiment as 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL';
    }
    return 'NEUTRAL';
  } catch (error) {
    console.error("SENTIMENT_ANALYSIS_FAILURE", error);
    return 'NEUTRAL';
  }
}

// --- Logic Helpers ---
function calculateOccupancy(rating: number, reviews: number) {
  const now = new Date();
  const hour = now.getHours();

  // Base occupancy by hour
  let base = 20;
  if (hour >= 8 && hour < 11) base = 35;
  else if (hour >= 11 && hour < 14) base = 75; // Lunch rush
  else if (hour >= 14 && hour < 17) base = 45;
  else if (hour >= 17 && hour < 21) base = 85; // Evening peak
  else if (hour >= 21) base = 40;
  else base = 10; // Early morning

  // Review weight (more reviews = likely more popular/busy)
  const popularityBoost = Math.min(15, reviews / 100);

  // Rating weight (higher rating = more attractive)
  const ratingBoost = (rating - 3) * 5;

  let final = base + popularityBoost + ratingBoost + (Math.random() * 10 - 5);
  final = Math.max(5, Math.min(98, final));

  let label = 'Quiet';
  if (final > 75) label = 'Very Busy';
  else if (final > 50) label = 'Busy';
  else if (final > 25) label = 'Medium';

  return { occupancy: Math.round(final), label };
}

function getDistance(l1: { lat: number, lng: number }, l2: { lat: number, lng: number }) {
  const R = 6371; // km
  const dLat = (l2.lat - l1.lat) * Math.PI / 180;
  const dLng = (l2.lng - l1.lng) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(l1.lat * Math.PI / 180) * Math.cos(l2.lat * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// --- Components ---

const TopAppBar = ({ onNavigateToAI }: { onNavigateToAI: () => void }) => (
  <header className="fixed top-0 left-0 w-full z-[60] glass-header h-16">
    <div className="flex justify-between items-center max-w-5xl mx-auto px-6 h-full text-on-surface">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-primary to-[#0E84C3] flex items-center justify-center shadow-md">
          <MapPin size={18} className="text-white" />
        </div>
        <span className="heading-bold text-xl text-primary tracking-tight">NongkrongYuk</span>
      </div>
      <div className="flex items-center gap-4">
        <button 
          onClick={onNavigateToAI}
          className="flex items-center gap-2 bg-primary/10 text-primary px-4 py-2 rounded-full text-sm font-semibold hover:bg-primary hover:text-white transition-all duration-300 active:scale-95 shadow-sm"
        >
          <Sparkles size={16} />
          <span>Tanya AI</span>
        </button>
      </div>
    </div>
  </header>
);

const BottomNavBar = ({ activePage, setActivePage }: { activePage: Page, setActivePage: (p: Page) => void }) => {
  const tabs: { id: Page, icon: any, label: string }[] = [
    { id: 'radar' as const, icon: MapPin, label: 'Beranda' },
    { id: 'spots' as const, icon: Coffee, label: 'Eksplor' },
    { id: 'ai-finder' as const, icon: Sparkles, label: 'AI Asisten' },
    { id: 'saved' as any, icon: Bookmark, label: 'Tersimpan' }
  ];

  return (
    <nav className="fixed bottom-0 left-0 w-full z-[60] glass-nav pb-safe">
      <div className="flex justify-around items-center h-16 max-w-md mx-auto px-2">
        {tabs.map((tab) => {
          const isActive = activePage === tab.id;
          const Icon = tab.icon;

          return (
            <button
              key={tab.id}
              onClick={() => setActivePage(tab.id)}
              className="flex-1 flex flex-col items-center justify-center gap-1 py-2 group"
            >
              <div className={`relative flex items-center justify-center transition-all ${isActive ? 'text-primary' : 'text-on-surface-variant group-hover:text-primary/70'}`}>
                {isActive && (
                  <motion.div
                    layoutId="nav-pill"
                    className="absolute inset-0 bg-primary/10 rounded-full w-12 h-8 -mx-3 -my-1.5"
                    transition={{ type: 'spring', bounce: 0.2, duration: 0.6 }}
                  />
                )}
                <Icon size={22} strokeWidth={isActive ? 2.5 : 2} className="relative z-10" />
              </div>
              <span className={`text-[10px] font-semibold transition-colors ${isActive ? 'text-primary' : 'text-on-surface-variant'}`}>
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};

// --- Page Views ---

const HomePage = ({ spots, userLocation, locationName, setLocationName, onSelectSpot, onNavigateToAI }: { 
  spots: Spot[], 
  userLocation: { lat: number, lng: number } | null, 
  locationName: string, 
  setLocationName: (name: string) => void,
  onSelectSpot: (s: Spot) => void, 
  onNavigateToAI: () => void 
}) => {
  const [nearbyResults, setNearbyResults] = useState<Spot[]>([]);
  const [loadingNearby, setLoadingNearby] = useState(false);
  const [activeCategory, setActiveCategory] = useState('Semua');
  const placesLib = useMapsLibrary('places');

  const categories = [
    { id: 'Semua', label: 'Semua', icon: MapPin },
    { id: 'Cafe', label: 'Cafe', icon: Coffee },
    { id: 'Restoran', label: 'Restoran', icon: List },
    { id: 'Warung', label: 'Warung', icon: Coffee },
  ];

  useEffect(() => {
    if (!placesLib || !userLocation) return;

    const fetchNearby = async () => {
      setLoadingNearby(true);
      try {
        const queryMap: Record<string, string> = {
          'Semua': 'Restaurant OR Cafe OR Warung OR Warkop OR Kedai',
          'Cafe': 'Cafe OR Coffee Shop OR Kopi',
          'Restoran': 'Restaurant OR Tempat Makan',
          'Warung': 'Warung OR Warkop OR Kedai OR Angkringan'
        };
        const textQuery = queryMap[activeCategory];

        const cleanName = locationName.includes('...') ? '' : locationName.replace('.OS', '');
        const { places } = await placesLib.Place.searchByText({
          textQuery: textQuery,
          locationBias: {
            center: userLocation,
            radius: 1500,
          },
          fields: ['id', 'displayName', 'location', 'formattedAddress', 'rating', 'userRatingCount', 'priceLevel', 'photos', 'reviews'],
          maxResultCount: 15,
          rankPreference: 'DISTANCE'
        });

        const filtered = places.filter(p => {
          const name = (p.displayName || '').toLowerCase();
          return !name.includes('toko') && !name.includes('shop') && !name.includes('market');
        });

        const processed = filtered.map(p => {
          const photos = p.photos?.slice(0, 5).map(photo => photo.getURI({ maxWidth: 800 })) || [];
          return {
            id: p.id,
            name: p.displayName || 'Lokasi',
            location: p.formattedAddress?.split(',')[0] || 'Tidak diketahui',
            rating: p.rating || 0,
            reviews: p.userRatingCount || 0,
            price: '$'.repeat(Number(p.priceLevel) || 1),
            openUntil: 'Buka',
            imageUrl: photos[0] || 'https://images.unsplash.com/photo-1501339817302-38203b9f9fef?auto=format&fit=crop&w=400&q=80',
            imageUrls: photos.length > 0 ? photos : ['https://images.unsplash.com/photo-1501339817302-38203b9f9fef?auto=format&fit=crop&w=400&q=80'],
            coordinates: { lat: p.location?.lat() || 0, lng: p.location?.lng() || 0 },
            stats: (() => {
              const { occupancy, label } = calculateOccupancy(p.rating || 0, p.userRatingCount || 0);
              return { crowd: label, occupancy, wifi: 'Tersedia' };
            })(),
            userReviews: [],
            googleReviews: (p as any).reviews?.map((r: any) => ({ text: r.text })) || []
          };
        }) as Spot[];

        setNearbyResults(processed);

        if (locationName.includes('Kordinat') || locationName.includes('Mencari Lokasi')) {
          const firstResult = processed[0];
          if (firstResult && firstResult.location) {
            const parts = firstResult.location.split(',');
            if (parts.length >= 2) {
              const cityPart = parts[parts.length - 2].trim();
              setLocationName(cityPart);
            }
          }
        }
      } catch (err) {
        console.error("NEARBY_FETCH_FAILED", err);
      } finally {
        setLoadingNearby(false);
      }
    };

    fetchNearby();
  }, [placesLib, userLocation, activeCategory, locationName, setLocationName]);

  const displaySpots = nearbyResults.length > 0 ? nearbyResults : spots;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="pt-20 pb-24 max-w-4xl mx-auto overflow-x-hidden"
    >
      {/* Hero Header Section */}
      <section className="px-6 py-8 hero-gradient text-white rounded-b-[2.5rem] shadow-lg mb-8 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3"></div>
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/10 rounded-full blur-2xl translate-y-1/3 -translate-x-1/4"></div>

        <div className="flex flex-col gap-5 relative z-10">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm opacity-90 font-medium mb-1">Lokasi Anda</p>
              <h1 className="text-3xl font-bold tracking-tight drop-shadow-sm">{locationName.replace('.OS', '')}</h1>
            </div>
          </div>

          <div className="relative mt-2">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <MapPin size={18} className="text-gray-400" />
            </div>
            <input
              type="text"
              className="w-full bg-white text-on-surface rounded-2xl py-4 pl-12 pr-4 shadow-[0_8px_30px_rgba(0,0,0,0.12)] focus:outline-none focus:ring-4 focus:ring-white/40 text-sm font-medium transition-all"
              placeholder="Cari tempat nongkrong..."
            />
          </div>
        </div>
      </section>

      {/* Category Categories */}
      <section className="px-6 mb-10">
        <h2 className="text-lg font-bold text-on-surface mb-5">Kategori</h2>
        <div className="flex gap-4 overflow-x-auto scrollbar-hide pb-4 -mx-6 px-6">
          {categories.map((cat) => {
            const Icon = cat.icon;
            const isActive = activeCategory === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={`flex flex-col items-center gap-3 min-w-[72px] transition-all duration-300 ${isActive ? 'opacity-100' : 'opacity-80 hover:opacity-100 hover:-translate-y-1'}`}
              >
                <div className={`w-16 h-16 rounded-[1.25rem] flex items-center justify-center transition-all duration-300 ${isActive ? 'bg-gradient-to-br from-primary to-[#0E84C3] text-white shadow-[0_8px_20px_rgba(27,160,226,0.4)] scale-105' : 'bg-white text-primary shadow-[0_4px_15px_rgba(0,0,0,0.05)] border border-gray-50'}`}>
                  <Icon size={26} strokeWidth={isActive ? 2.5 : 2} />
                </div>
                <span className={`text-xs font-bold ${isActive ? 'text-primary' : 'text-on-surface-variant'}`}>{cat.label}</span>
              </button>
            )
          })}
        </div>
      </section>

      {/* Recommendations */}
      <section className="mb-12">
        <div className="flex justify-between items-center mb-5 px-6">
          <h2 className="text-lg font-bold text-on-surface">Rekomendasi Terdekat</h2>
          <button className="text-sm font-bold text-primary hover:text-[#0E84C3] transition-colors">Lihat Semua</button>
        </div>

        <div className="flex gap-5 overflow-x-auto pb-8 px-6 scrollbar-hide snap-x">
          {loadingNearby ? (
            [1, 2, 3].map(i => (
              <div key={i} className="flex-shrink-0 w-[260px] h-[300px] bg-surface-dim animate-pulse rounded-[1.5rem]" />
            ))
          ) : (
            displaySpots.slice(0, 6).map((spot) => (
              <motion.div
                key={spot.id}
                whileTap={{ scale: 0.98 }}
                onClick={() => onSelectSpot(spot)}
                className="flex-shrink-0 w-[260px] snap-start premium-card cursor-pointer group overflow-hidden"
              >
                <div className="relative h-44 overflow-hidden bg-surface-dim">
                  <img src={spot.imageUrl} alt={spot.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700 ease-out" />
                  <div className="absolute top-3 left-3 bg-white/95 backdrop-blur-md text-on-surface px-2.5 py-1.5 rounded-lg text-xs font-bold shadow-sm flex items-center gap-1.5">
                    <Star size={14} className="text-yellow-500 fill-yellow-500" /> {spot.rating}
                  </div>
                </div>
                <div className="p-5 space-y-2">
                  <h3 className="text-base font-bold text-on-surface truncate group-hover:text-primary transition-colors">{spot.name}</h3>
                  <div className="flex items-center text-on-surface-variant text-xs gap-1.5 font-medium">
                    <MapPin size={14} className="text-primary/70" />
                    <span className="truncate">{spot.location}</span>
                  </div>
                  <div className="flex items-center justify-between pt-3 mt-1 border-t border-gray-50">
                    <span className="text-sm font-bold text-primary">{spot.price}</span>
                    <span className="text-[10px] font-bold text-tertiary bg-tertiary/10 px-2.5 py-1 rounded-full">{spot.stats.crowd}</span>
                  </div>
                </div>
              </motion.div>
            ))
          )}
        </div>
      </section>

      {/* Tanya AI Banner */}
      <section className="px-6 mb-8">
        <motion.div
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={onNavigateToAI}
          className="ai-gradient rounded-[1.5rem] p-6 relative overflow-hidden flex items-center justify-between cursor-pointer border border-primary/10 shadow-[0_8px_30px_rgba(27,160,226,0.12)] transition-all duration-300"
        >
          <div className="relative z-10 space-y-2 max-w-[70%]">
            <div className="flex items-center gap-2 mb-1">
              <div className="bg-white/60 p-1.5 rounded-lg backdrop-blur-sm">
                <Sparkles size={16} className="text-primary" />
              </div>
              <span className="text-[10px] font-bold text-primary tracking-wider uppercase">AI ASISTEN</span>
            </div>
            <h3 className="text-xl font-bold text-on-primary-container leading-tight drop-shadow-sm">Cari Tempat Sesuai Mood?</h3>
            <p className="text-sm font-medium text-on-primary-container/80">Tanya AI kami untuk rekomendasi terbaik.</p>
          </div>
          <div className="relative z-10 w-12 h-12 bg-white rounded-full flex items-center justify-center text-primary shadow-[0_4px_15px_rgba(0,0,0,0.05)] group-hover:bg-primary group-hover:text-white transition-colors duration-300">
            <ArrowRight size={20} />
          </div>
          {/* Decorative shapes */}
          <div className="absolute right-[-10%] top-[-20%] w-40 h-40 bg-white/40 rounded-full blur-2xl" />
          <div className="absolute left-[30%] bottom-[-30%] w-32 h-32 bg-[#1BA0E2]/10 rounded-full blur-2xl" />
        </motion.div>
      </section>
    </motion.div>
  );
};

const AIFinderPage = ({ spots, userLocation, locationName, onSelectSpot }: { spots: Spot[], userLocation: { lat: number, lng: number } | null, locationName: string, onSelectSpot: (s: Spot) => void }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Spot[]>([]);
  const [searching, setSearching] = useState(false);
  const placesLib = useMapsLibrary('places');

  const handleSearch = async () => {
    if (!placesLib || !query) return;
    setSearching(true);
    try {
      const cleanLocationName = locationName.includes('...') ? '' : locationName.replace('.OS', '').replace('.CORE', '');
      const searchOptions: any = {
        textQuery: query ? `${query} cafe warung ${cleanLocationName}` : `cafe warung kopi ${cleanLocationName}`,
        fields: ['id', 'displayName', 'location', 'formattedAddress', 'rating', 'userRatingCount', 'priceLevel', 'photos', 'reviews'],
        maxResultCount: 15,
      };

      if (userLocation) {
        searchOptions.locationBias = {
          center: userLocation,
          radius: 15000
        };
      }

      const { places } = await placesLib.Place.searchByText(searchOptions);

      const processedResults: Spot[] = places.map(p => {
        const photos = p.photos?.slice(0, 5).map(photo => photo.getURI({ maxWidth: 800 })) || [];
        return {
          id: p.id,
          name: p.displayName || 'Lokasi',
          location: p.formattedAddress?.split(',')[0] || 'Tidak diketahui',
          distance: 'Dekat',
          vibe: 'Nyaman',
          rating: p.rating || 0,
          reviews: p.userRatingCount || 0,
          price: p.priceLevel ? '$'.repeat(Number(p.priceLevel)) : '$$',
          openUntil: 'Buka',
          imageUrl: photos[0] || 'https://images.unsplash.com/photo-1501339817302-38203b9f9fef?auto=format&fit=crop&w=800&q=80',
          imageUrls: photos.length > 0 ? photos : ['https://images.unsplash.com/photo-1501339817302-38203b9f9fef?auto=format&fit=crop&w=800&q=80'],
          coordinates: { lat: p.location?.lat() || 0, lng: p.location?.lng() || 0 },
          stats: (() => {
            const { occupancy, label } = calculateOccupancy(p.rating || 0, p.userRatingCount || 0);
            return { crowd: label, occupancy, wifi: 'Tersedia' };
          })(),
          userReviews: [],
          googleReviews: (p as any).reviews?.map((r: any) => ({ text: r.text })) || []
        };
      });
      setResults(processedResults);
    } catch (err) {
      console.error('SEARCH_PROTOCOL_FAILURE:', err);
    } finally {
      setSearching(false);
    }
  };

  const chips = ["Kerja Tenang", "Kopi Murah", "Vibe Estetik", "Buka Malam"];
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="pt-20 pb-32 px-6 max-w-4xl mx-auto"
    >
      <div className="bg-primary-container rounded-3xl p-8 mb-8 text-center shadow-sm relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-white/10 to-transparent pointer-events-none" />
        <div className="relative z-10 flex flex-col items-center">
          <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-md mb-4">
            <Sparkles size={32} className="text-primary" />
          </div>
          <h2 className="text-2xl font-bold text-on-primary-container mb-2">Tanya AI Asisten</h2>
          <p className="text-sm text-on-primary-container/80 max-w-xs mx-auto">Beritahu kami mood atau kebutuhanmu, dan AI akan mencarikan tempat yang pas.</p>
        </div>
      </div>

      <div className="mb-6">
        <div className="relative flex items-center bg-surface-bright rounded-2xl overflow-hidden border border-outline-variant shadow-sm p-2 focus-within:ring-2 focus-within:ring-primary/50 transition-all">
          <div className="pl-4">
            <Sparkles size={20} className="text-primary" />
          </div>
          <input
            className="flex-1 bg-transparent border-none focus:outline-none text-base py-3 px-4 text-on-surface"
            placeholder="Contoh: Cafe outdoor yang sepi..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          />
          <button
            onClick={handleSearch}
            disabled={searching}
            className="bg-primary text-white px-6 py-3 rounded-xl font-bold text-sm hover:bg-primary/90 active:scale-95 transition-all disabled:opacity-50"
          >
            {searching ? 'Mencari...' : 'Cari'}
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-10">
        {chips.map(c => (
          <motion.button
            key={c}
            whileTap={{ scale: 0.95 }}
            onClick={() => { setQuery(c); handleSearch(); }}
            className={`px-4 py-2 rounded-full text-xs font-semibold border transition-all ${query === c ? 'bg-primary text-white border-primary shadow-sm' : 'bg-surface-bright text-on-surface-variant border-outline-variant hover:border-primary/50'}`}
          >
            {c}
          </motion.button>
        ))}
      </div>

      <div className="flex flex-col gap-4">
        {(results.length > 0 ? results : (query ? [] : spots.slice(1, 3))).map((spot, idx) => (
          <motion.div
            key={spot.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.05 }}
            onClick={() => onSelectSpot(spot)}
            className="bg-surface-bright rounded-2xl p-4 flex flex-col sm:flex-row gap-4 cursor-pointer hover:border-primary/50 border border-outline-variant transition-all shadow-sm group"
          >
            <div className="w-full sm:w-32 h-40 sm:h-32 flex-shrink-0 bg-surface-dim rounded-xl overflow-hidden relative">
              <img src={spot.imageUrl} alt={spot.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
            </div>
            <div className="flex-1 flex flex-col justify-between py-1">
              <div>
                <div className="flex justify-between items-start mb-1">
                  <h3 className="font-bold text-lg text-on-surface line-clamp-1">{spot.name}</h3>
                  <div className="flex items-center text-sm font-bold text-on-surface-variant gap-1">
                    <Star size={14} className="text-yellow-500 fill-yellow-500" /> {spot.rating}
                  </div>
                </div>
                <div className="flex items-center text-xs text-on-surface-variant mb-2">
                  <MapPin size={12} className="mr-1" />
                  <span className="line-clamp-1">{spot.location}</span>
                </div>
              </div>

              <div className="flex items-center justify-between mt-4 sm:mt-0 pt-4 sm:pt-0 border-t sm:border-t-0 border-outline-variant">
                <div className="flex gap-2">
                  <span className="text-[10px] font-semibold text-primary bg-primary/10 px-2 py-1 rounded-md">{spot.price}</span>
                  <span className="text-[10px] font-semibold text-tertiary bg-tertiary/10 px-2 py-1 rounded-md">{spot.stats.crowd}</span>
                </div>
                <ArrowRight size={18} className="text-primary opacity-0 group-hover:opacity-100 -translate-x-2 group-hover:translate-x-0 transition-all" />
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
};

const ReviewSection = ({ spot }: { spot: Spot }) => {
  const [analyzedReviews, setAnalyzedReviews] = useState<{ text: string, sentiment: 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL' }[]>([]);
  const [loadingSentiment, setLoadingSentiment] = useState(false);

  useEffect(() => {
    const processReviews = async () => {
      if (!spot.googleReviews || spot.googleReviews.length === 0) return;

      setLoadingSentiment(true);
      try {
        const processed = await Promise.all(spot.googleReviews.slice(0, 4).map(async (r) => {
          const sentiment = await analyzeSentiment(r.text);
          return { text: r.text, sentiment };
        }));
        setAnalyzedReviews(processed);
      } catch (err) {
        console.error("Failed to analyze sentiment", err);
        setAnalyzedReviews(spot.googleReviews.slice(0, 4).map(r => ({ text: r.text, sentiment: 'NEUTRAL' })));
      } finally {
        setLoadingSentiment(false);
      }
    };

    processReviews();
  }, [spot.id]);

  if (!spot.googleReviews || spot.googleReviews.length === 0) {
    return (
      <section className="pt-8 mt-8 border-t border-outline-variant">
        <h3 className="text-xl font-bold text-on-surface mb-4">Ulasan Pengunjung</h3>
        <div className="bg-surface-bright p-8 rounded-2xl border border-outline-variant text-center">
          <p className="text-sm text-on-surface-variant">Belum ada ulasan untuk tempat ini.</p>
        </div>
      </section>
    );
  }

  return (
    <section className="pt-8 mt-8 border-t border-outline-variant">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-xl font-bold text-on-surface">Ulasan Pengunjung</h3>
        <div className="flex items-center gap-2 bg-yellow-50 text-yellow-700 px-3 py-1 rounded-lg">
          <Star size={16} className="fill-current" />
          <span className="font-bold">{spot.rating}</span>
        </div>
      </div>

      {loadingSentiment ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[1, 2].map((i) => (
             <div key={i} className="h-32 bg-surface-dim rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {analyzedReviews.map((review, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.1 }}
              className="p-5 rounded-2xl border border-outline-variant bg-surface-bright shadow-sm relative overflow-hidden"
            >
              <div className="flex justify-between items-start mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-surface-dim rounded-full flex items-center justify-center text-primary font-bold">
                    {idx + 1}
                  </div>
                  <span className="text-sm font-semibold text-on-surface">Pengunjung Google</span>
                </div>
                <div className={`px-2 py-1 text-[10px] font-bold rounded-md ${
                  review.sentiment === 'POSITIVE' ? 'bg-green-50 text-green-600 border border-green-200' :
                  review.sentiment === 'NEGATIVE' ? 'bg-red-50 text-red-600 border border-red-200' :
                  'bg-gray-50 text-gray-500 border border-gray-200'
                }`}>
                  {review.sentiment === 'POSITIVE' ? 'Positif' : review.sentiment === 'NEGATIVE' ? 'Negatif' : 'Netral'}
                </div>
              </div>

              <p className="text-sm font-medium text-on-surface-variant leading-relaxed line-clamp-4">
                "{review.text}"
              </p>
            </motion.div>
          ))}
        </div>
      )}
    </section>
  );
};

const RouteView = ({ from, to }: { from: { lat: number, lng: number }, to: { lat: number, lng: number } }) => {
  const map = useMap();
  const routesLib = useMapsLibrary('routes');
  const [directionsRenderer, setDirectionsRenderer] = useState<google.maps.DirectionsRenderer | null>(null);

  useEffect(() => {
    if (!routesLib || !map) return;
    const renderer = new routesLib.DirectionsRenderer({ map });
    setDirectionsRenderer(renderer);
    return () => renderer.setMap(null);
  }, [routesLib, map]);

  useEffect(() => {
    if (!directionsRenderer || !from || !to) return;
    const service = new google.maps.DirectionsService();
    service.route(
      {
        origin: from,
        destination: to,
        travelMode: google.maps.TravelMode.DRIVING,
      },
      (result, status) => {
        if (status === 'OK' && result) {
          directionsRenderer.setDirections(result);
        } else {
          console.error("DIRECTIONS_SERVICE_FAILED", status);
        }
      }
    );
  }, [directionsRenderer, from, to]);

  return null;
};

const SavedPage = ({ savedSpots, onSelectSpot }: { savedSpots: Spot[], onSelectSpot: (s: Spot) => void }) => {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="pt-20 px-6 pb-32 max-w-4xl mx-auto"
    >
      <div className="flex flex-col gap-6 border-b border-outline-variant pb-6 mb-6">
        <div>
          <h2 className="text-2xl font-bold text-on-surface">Tersimpan</h2>
          <p className="text-sm text-on-surface-variant mt-1">Daftar tempat nongkrong favoritmu.</p>
        </div>
      </div>

      {savedSpots.length === 0 ? (
        <div className="text-center py-20 bg-surface-bright rounded-[1.5rem] border border-outline-variant/50 shadow-sm mx-4 sm:mx-0">
          <div className="w-20 h-20 bg-surface-dim rounded-full flex items-center justify-center mx-auto mb-5">
            <Bookmark size={32} className="text-primary/40" />
          </div>
          <h3 className="text-xl font-bold text-on-surface mb-2">Belum ada yang disimpan</h3>
          <p className="text-sm text-on-surface-variant max-w-xs mx-auto">Jelajahi tempat menarik dan tekan ikon bookmark untuk menyimpannya ke daftar ini.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          {savedSpots.map((spot, idx) => (
            <motion.div
              key={spot.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
              onClick={() => onSelectSpot(spot)}
              className="premium-card p-3 flex gap-4 cursor-pointer group"
            >
              <div className="w-28 h-28 flex-shrink-0 bg-surface-dim rounded-xl overflow-hidden relative">
                <img src={spot.imageUrl} alt={spot.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700 ease-out" />
                <div className="absolute top-2 left-2 bg-white/95 backdrop-blur-md text-on-surface px-1.5 py-0.5 rounded text-[10px] font-bold shadow-sm flex items-center gap-1">
                  <Star size={10} className="text-yellow-500 fill-yellow-500" /> {spot.rating}
                </div>
              </div>
              <div className="flex-1 flex flex-col justify-between py-1.5 pr-2">
                <div>
                  <h3 className="font-bold text-base text-on-surface line-clamp-1 group-hover:text-primary transition-colors">{spot.name}</h3>
                  <p className="text-xs text-on-surface-variant line-clamp-1 mt-1 font-medium flex items-center gap-1">
                    <MapPin size={12} className="text-primary/70 flex-shrink-0" />
                    {spot.location}
                  </p>
                </div>
                <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-50">
                  <span className="text-sm font-bold text-primary">{spot.price}</span>
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-white transition-colors duration-300">
                    <Bookmark size={16} className="fill-current" />
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </motion.div>
  );
};

const DetailPage = ({ spot, userLocation, onUpdateSpot, onBack, onShare, isSaved, onToggleSave }: { spot: Spot, userLocation: { lat: number, lng: number } | null, onUpdateSpot: (s: Spot) => void, onBack: () => void, onShare: () => void, isSaved: boolean, onToggleSave: (s: Spot) => void }) => {
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);
  const [extractedMenu, setExtractedMenu] = useState<{ name: string, price: number }[]>([]);
  const [insights, setInsights] = useState<{ sellingPoints: string[], weaknesses: string[] }>({
    sellingPoints: ['Nyaman', 'Lokasi Strategis'],
    weaknesses: ['Parkir Terbatas']
  });
  const [loadingMenu, setLoadingMenu] = useState(false);

  useEffect(() => {
    const fetchExtractedMenu = async () => {
      if (!spot.googleReviews || spot.googleReviews.length === 0) {
        setExtractedMenu([]);
        return;
      }

      setLoadingMenu(true);
      try {
        const reviewText = spot.googleReviews.map(r => r.text).join('\n---\n');
        const prompt = `Following are Google Maps reviews for a place named "${spot.name}" in "${spot.location}". 
        1. Extract 4-5 typical menu items and their estimated prices in IDR.
        2. Identify what this place is famous for / what they sell primarily (Selling Points).
        3. Identify the main weaknesses or common complaints (Weaknesses).
        
        Return ONLY a JSON object with:
        {
          "menu": [{"name": string, "price": number}],
          "sellingPoints": [string],
          "weaknesses": [string]
        }
        
        Reviews:
        ${reviewText.substring(0, 3000)}`;

        const response = await ai.models.generateContent({
          model: "gemini-1.5-flash-latest",
          contents: prompt
        });

        const text = response.text.replace(/```json|```/g, '').trim();
        const parsed = JSON.parse(text);
        
        if (parsed.menu) setExtractedMenu(parsed.menu.slice(0, 6));
        if (parsed.sellingPoints || parsed.weaknesses) {
          setInsights({
            sellingPoints: parsed.sellingPoints || [],
            weaknesses: parsed.weaknesses || []
          });
        }
      } catch (err) {
        console.error("AI_INSIGHTS_FAILED", err);
      } finally {
        setLoadingMenu(false);
      }
    };

    fetchExtractedMenu();
  }, [spot.id]);

  const nextPhoto = useCallback(() => {
    setCurrentPhotoIndex((prev) => (prev + 1) % spot.imageUrls.length);
  }, [spot.imageUrls.length]);

  const prevPhoto = useCallback(() => {
    setCurrentPhotoIndex((prev) => (prev - 1 + spot.imageUrls.length) % spot.imageUrls.length);
  }, [spot.imageUrls.length]);

  const basePrice = spot.price.length * 15000 + 10000;
  const menu = extractedMenu.length > 0 ? extractedMenu : [
    { name: 'Kopi Susu Lokal', price: basePrice },
    { name: 'Nasi Goreng', price: basePrice + 10000 },
    { name: 'Kentang Goreng', price: basePrice - 5000 },
    { name: 'Teh Manis', price: basePrice - 10000 },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, x: 50 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -50 }}
      className="bg-surface min-h-screen pb-32 overflow-x-hidden"
    >
      <header className="fixed top-0 left-0 w-full z-[70] glass-header px-4 h-16 flex items-center justify-between">
        <button onClick={onBack} className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-surface-dim transition-colors text-on-surface">
          <ChevronLeft size={24} />
        </button>
        <span className="font-bold text-on-surface truncate px-4">{spot.name}</span>
        <div className="flex items-center gap-1">
          <button onClick={onShare} className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-surface-dim transition-colors"><Share2 size={20} className="text-on-surface" /></button>
          <button onClick={() => onToggleSave(spot)} className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-surface-dim transition-colors">
            <Bookmark size={20} className={`transition-colors ${isSaved ? 'text-primary fill-primary' : 'text-on-surface'}`} />
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto pt-16">
        {/* Photo Gallery */}
        <section className="relative w-full aspect-video sm:aspect-[21/9] bg-surface-dim overflow-hidden shadow-sm">
          <AnimatePresence mode="wait">
            <motion.img
              key={currentPhotoIndex}
              src={spot.imageUrls[currentPhotoIndex]}
              alt={`${spot.name} - ${currentPhotoIndex + 1}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="w-full h-full object-cover"
            />
          </AnimatePresence>

          <div className="absolute bottom-4 right-4 bg-black/60 text-white px-3.5 py-1.5 rounded-full text-xs font-bold backdrop-blur-md shadow-lg">
            {currentPhotoIndex + 1} / {spot.imageUrls.length}
          </div>

          {spot.imageUrls.length > 1 && (
            <>
              <button onClick={prevPhoto} className="absolute left-4 top-1/2 -translate-y-1/2 w-12 h-12 bg-white/20 text-white rounded-full flex items-center justify-center backdrop-blur-md hover:bg-white/40 border border-white/30 transition-all shadow-lg active:scale-95">
                <ChevronLeft size={26} />
              </button>
              <button onClick={nextPhoto} className="absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 bg-white/20 text-white rounded-full flex items-center justify-center backdrop-blur-md hover:bg-white/40 border border-white/30 transition-all shadow-lg active:scale-95">
                <ArrowRight size={26} />
              </button>
            </>
          )}
        </section>

        <div className="p-6 space-y-8 -mt-6 relative z-10 bg-surface rounded-t-3xl">
          {/* Main Info */}
          <section className="space-y-4">
            <div>
              <h1 className="text-3xl font-extrabold text-on-surface drop-shadow-sm">{spot.name}</h1>
              <div className="flex items-center gap-2 text-on-surface-variant mt-2 text-sm font-medium">
                <MapPin size={16} className="text-primary/70" />
                <span>{spot.location}</span>
              </div>
            </div>

            <div className="flex flex-wrap gap-4 py-4 border-y border-outline-variant">
              <div className="flex items-center gap-2">
                <Star size={20} className="text-yellow-500 fill-yellow-500 drop-shadow-sm" />
                <span className="font-bold text-on-surface text-lg">{spot.rating}</span>
                <span className="text-on-surface-variant text-sm font-medium">({spot.reviews} ulasan)</span>
              </div>
              <div className="w-px h-6 bg-outline-variant hidden sm:block"></div>
              <div className="flex items-center gap-2 text-primary text-sm font-bold">
                <span className="bg-primary/10 px-2.5 py-1 rounded-md">{spot.price}</span>
              </div>
              <div className="w-px h-6 bg-outline-variant hidden sm:block"></div>
              <div className="flex items-center gap-2 text-sm">
                <span className="font-bold text-tertiary">Buka</span>
                <span className="text-on-surface-variant font-medium">hingga {spot.openUntil}</span>
              </div>
            </div>
          </section>

          {/* Action Buttons */}
          <section className="flex gap-4">
            <button
              onClick={() => {
                if (userLocation) {
                  const url = `https://www.google.com/maps/dir/?api=1&origin=${userLocation.lat},${userLocation.lng}&destination=${spot.coordinates.lat},${spot.coordinates.lng}&travelmode=driving`;
                  window.open(url, '_blank');
                } else {
                  alert("Lokasi Anda belum tersedia.");
                }
              }}
              className="flex-1 bg-gradient-to-r from-primary to-[#0E84C3] text-white py-3.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 hover:shadow-[0_8px_20px_rgba(27,160,226,0.3)] transition-all active:scale-95 shadow-md"
            >
              <MapIcon size={18} /> Rute
            </button>
            <button
              onClick={() => alert(`Reservasi meja di ${spot.name} berhasil diajukan!`)}
              className="flex-1 bg-white text-primary border border-primary/30 py-3.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 hover:bg-primary/5 hover:border-primary/50 transition-all active:scale-95 shadow-[0_4px_15px_rgba(0,0,0,0.02)]"
            >
              <Sparkles size={18} /> Reservasi Meja
            </button>
          </section>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="md:col-span-2 space-y-8">
              {/* Menu Section */}
              <section className="premium-card p-6">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-lg font-bold text-on-surface">Menu Populer</h3>
                  {loadingMenu && <span className="text-xs text-primary animate-pulse">Memuat...</span>}
                </div>

                <div className="space-y-4">
                  {menu.map((item, i) => (
                    <div key={i} className="flex justify-between items-center border-b border-outline-variant pb-3 last:border-0 last:pb-0">
                      <span className="font-semibold text-on-surface">{item.name}</span>
                      <span className="font-bold text-primary">Rp {item.price.toLocaleString('id-ID')}</span>
                    </div>
                  ))}
                </div>
              </section>

              {/* Review Form Component */}
              <ReviewSection spot={spot} />
            </div>

            <div className="space-y-6">
              {/* Info Cards */}
              <div className="bg-surface-bright rounded-2xl p-6 border border-outline-variant shadow-sm space-y-4">
                <h3 className="text-base font-bold text-on-surface">Kondisi Saat Ini</h3>
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-full border-4 border-tertiary flex items-center justify-center text-xl font-bold text-on-surface">
                    {spot.stats.occupancy}%
                  </div>
                  <div>
                    <p className="font-bold text-tertiary">{spot.stats.crowd}</p>
                    <p className="text-xs text-on-surface-variant">Tingkat keramaian</p>
                  </div>
                </div>
              </div>

              {/* Highlights */}
              <div className="bg-surface-bright rounded-2xl p-6 border border-outline-variant shadow-sm space-y-4">
                <div>
                  <h4 className="text-sm font-bold text-on-surface mb-2 flex items-center gap-2"><Sparkles size={14} className="text-primary"/> Keunggulan</h4>
                  <div className="flex flex-wrap gap-2">
                    {insights.sellingPoints.map((item, i) => (
                      <span key={i} className="text-xs font-semibold bg-primary/10 text-primary px-2 py-1 rounded-md">{item}</span>
                    ))}
                  </div>
                </div>
                <div className="pt-4 border-t border-outline-variant">
                  <h4 className="text-sm font-bold text-on-surface mb-2">Kekurangan</h4>
                  <div className="flex flex-wrap gap-2">
                    {insights.weaknesses.map((item, i) => (
                      <span key={i} className="text-xs font-semibold bg-surface-dim text-on-surface-variant px-2 py-1 rounded-md">{item}</span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Map View */}
              <div className="bg-surface-bright rounded-2xl overflow-hidden border border-outline-variant shadow-sm aspect-square">
                {hasValidKey ? (
                  <Map
                    defaultCenter={spot.coordinates}
                    defaultZoom={15}
                    mapId="DETAIL_MAP_ID"
                    disableDefaultUI={true}
                    gestureHandling={'greedy'}
                    style={{ width: '100%', height: '100%' }}
                  >
                    <AdvancedMarker position={spot.coordinates} />
                    {userLocation && (
                      <AdvancedMarker position={userLocation}>
                        <div className="w-4 h-4 bg-primary rounded-full border-2 border-white shadow-md" />
                      </AdvancedMarker>
                    )}
                    {userLocation && <RouteView from={userLocation} to={spot.coordinates} />}
                  </Map>
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-xs text-on-surface-variant bg-surface-dim">
                    Peta tidak tersedia
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
    </motion.div>
  );
};

const MapView = ({ spots, userLocation, onSelectSpot }: { spots: Spot[], userLocation: { lat: number, lng: number } | null, onSelectSpot: (s: Spot) => void }) => {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selectedSpot = spots.find(s => s.id === selectedId);
  const defaultCenter = userLocation || { lat: -7.8480, lng: 112.0178 };

  if (!hasValidKey) {
    return (
      <div className="w-full h-[60vh] flex flex-col items-center justify-center border border-on-surface/10 bg-surface-container p-8 text-center bg-[#0a0a0a] text-[#f5f5f4] font-sans">
        <h2 className="heading-bold text-2xl mb-4">Kunci API Google Maps Diperlukan</h2>
        <p className="text-sm opacity-60 mb-6 max-w-md italic">
          \"Gagal protokol: Visualisasi geospasial memerlukan kredensial yang valid. Tautan saraf ditolak.\"
        </p>
        <div className="text-left space-y-4 max-w-sm mx-auto label-mono text-[10px]">
          <div className="p-4 border border-on-surface/20">
            <p className="mb-2">1. Ambil kunci API dari Google Cloud Console</p>
            <p>2. Tambahkan sebagai rahasia: <span className="text-secondary-container">GOOGLE_MAPS_PLATFORM_KEY</span></p>
          </div>
          <p className="opacity-40 text-center">SISTEM_MENUNGGU_KUNCI...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-[60vh] border border-on-surface/10 bg-surface-container relative overflow-hidden">
      <Map
        defaultCenter={defaultCenter}
        center={userLocation}
        defaultZoom={14}
        mapId="DEMO_MAP_ID"
        // internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
        style={{ width: '100%', height: '100%' }}
        disableDefaultUI={true}
        gestureHandling={'greedy'}
      >
        {/* Penanda Posisi User */}
        {userLocation && (
          <AdvancedMarker position={userLocation}>
            <div className="relative flex items-center justify-center">
              <div className="absolute w-8 h-8 bg-cyan-400/30 rounded-full animate-ping" />
              <div className="w-4 h-4 bg-cyan-400 rounded-full border-2 border-white shadow-[0_0_15px_rgba(34,211,238,0.8)]" />
            </div>
          </AdvancedMarker>
        )}

        {spots.map(spot => (
          <AdvancedMarker
            key={spot.id}
            position={spot.coordinates}
            onClick={() => setSelectedId(spot.id)}
          >
            <div className={`px-3 py-1 bg-on-surface text-surface label-mono !text-[8px] font-black italic shadow-2xl transition-all duration-300 border ${selectedId === spot.id ? 'scale-125 border-secondary-container bg-surface text-on-surface' : 'scale-100 opacity-60 border-transparent'}`}>
              {spot.name.toUpperCase()}
            </div>
          </AdvancedMarker>
        ))}

        {selectedId && selectedSpot && (
          <InfoWindow
            position={selectedSpot.coordinates}
            onCloseClick={() => setSelectedId(null)}
            headerDisabled={true}
          >
            <div className="p-4 min-w-[240px] bg-[#0a0a0a] text-[#f5f5f4] border border-[#f5f5f4]/10">
              <div className="aspect-video overflow-hidden mb-4 border border-[#f5f5f4]/10 bg-surface-container">
                <img src={selectedSpot.imageUrl} className="w-full h-full object-cover grayscale brightness-75 hover:grayscale-0 transition-all duration-500" />
              </div>
              <h4 className="heading-bold text-xl mb-1">{selectedSpot.name}</h4>
              <p className="label-mono !text-[8px] opacity-40 mb-4">{selectedSpot.location} // CLS: {selectedSpot.distance}</p>
              <button
                onClick={() => onSelectSpot(selectedSpot)}
                className="w-full py-3 bg-[#f5f5f4] text-[#0a0a0a] label-mono !text-[10px] font-black hover:opacity-90 active:translate-y-0.5 transition-all"
              >
                JALANKAN_PEMINDAIAN_DETAIL
              </button>
            </div>
          </InfoWindow>
        )}
      </Map>
    </div>
  );
}

// --- Main App ---

const SpotsPage = ({ spots, userLocation, onSelectSpot }: { spots: Spot[], userLocation: { lat: number, lng: number } | null, onSelectSpot: (s: Spot) => void }) => {
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list');
  const [recommendations, setRecommendations] = useState<Spot[]>([]);
  const placesLib = useMapsLibrary('places');

  useEffect(() => {
    const getRecommendations = async () => {
      if (!placesLib || !userLocation) {
        setRecommendations(spots.slice(0, 5));
        return;
      }

      try {
        const { places } = await placesLib.Place.searchByText({
          textQuery: "coffee shops specialty cafe",
          locationBias: { center: userLocation, radius: 3000 },
          fields: ['id', 'displayName', 'location', 'formattedAddress', 'rating', 'userRatingCount', 'priceLevel', 'photos', 'reviews'],
          maxResultCount: 5,
        });

        const processed = places.map(p => {
          const photos = p.photos?.slice(0, 5).map(photo => photo.getURI({ maxWidth: 800 })) || [];
          return {
            id: p.id,
            name: p.displayName || 'Lokasi',
            location: p.formattedAddress?.split(',')[0] || 'Tidak diketahui',
            distance: 'Dekat',
            rating: p.rating || 0,
            reviews: p.userRatingCount || 0,
            price: p.priceLevel ? '$'.repeat(Number(p.priceLevel)) : '$$',
            openUntil: 'Buka',
            imageUrl: photos[0] || 'https://images.unsplash.com/photo-1501339817302-38203b9f9fef?auto=format&fit=crop&w=400&q=80',
            imageUrls: photos.length > 0 ? photos : ['https://images.unsplash.com/photo-1501339817302-38203b9f9fef?auto=format&fit=crop&w=400&q=80'],
            coordinates: { lat: p.location?.lat() || 0, lng: p.location?.lng() || 0 },
            stats: (() => {
              const { occupancy, label } = calculateOccupancy(p.rating || 0, p.userRatingCount || 0);
              return { crowd: label, occupancy, wifi: 'Tersedia' };
            })(),
            userReviews: [],
            googleReviews: (p as any).reviews?.map((r: any) => ({ text: r.text })) || []
          };
        }) as Spot[];

        setRecommendations(processed);
      } catch (err) {
        console.error("REC_LOAD_FAILED", err);
        setRecommendations(spots.slice(0, 5));
      }
    };

    getRecommendations();
  }, [placesLib, userLocation, spots.length]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="pt-20 px-6 pb-32 max-w-4xl mx-auto"
    >
      <div className="flex flex-col gap-6 border-b border-outline-variant pb-6 mb-6">
        <div>
          <h2 className="text-2xl font-bold text-on-surface">Eksplor Tempat</h2>
          <p className="text-sm text-on-surface-variant mt-1">Temukan spot nongkrong terbaik di sekitarmu.</p>
        </div>

        <div className="flex p-1 bg-surface-dim rounded-full w-full max-w-[240px]">
          <button
            onClick={() => setViewMode('list')}
            className={`flex-1 py-2 rounded-full flex items-center justify-center gap-2 transition-all text-xs font-bold ${viewMode === 'list' ? 'bg-white text-primary shadow-sm' : 'text-on-surface-variant hover:text-primary'}`}
          >
            <List size={16} /> Daftar
          </button>
          <button
            onClick={() => setViewMode('map')}
            className={`flex-1 py-2 rounded-full flex items-center justify-center gap-2 transition-all text-xs font-bold ${viewMode === 'map' ? 'bg-white text-primary shadow-sm' : 'text-on-surface-variant hover:text-primary'}`}
          >
            <MapIcon size={16} /> Peta
          </button>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {viewMode === 'list' ? (
          <motion.div
            key="list"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-8"
          >
            {/* Recommendations Section */}
            <section>
              <h3 className="text-lg font-bold text-on-surface mb-4">Mungkin Kamu Suka</h3>
              <div className="flex gap-5 overflow-x-auto pb-6 scrollbar-hide snap-x -mx-6 px-6">
                {recommendations.map((s, idx) => (
                  <motion.div
                    key={s.id}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => onSelectSpot(s)}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: idx * 0.1 }}
                    className="flex-shrink-0 w-64 snap-start premium-card cursor-pointer group overflow-hidden"
                  >
                    <div className="relative h-40">
                      <img src={s.imageUrl} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700 ease-out" />
                      <div className="absolute top-3 right-3 bg-white/95 backdrop-blur-md text-on-surface px-2 py-1 rounded-lg text-xs font-bold shadow-sm flex items-center gap-1.5">
                        <Star size={12} className="text-yellow-500 fill-yellow-500" /> {s.rating}
                      </div>
                    </div>
                    <div className="p-4 space-y-2">
                      <h4 className="font-bold text-base mb-1 truncate text-on-surface group-hover:text-primary transition-colors">{s.name}</h4>
                      <div className="flex items-center text-on-surface-variant text-xs gap-1.5 mb-2 font-medium">
                        <MapPin size={14} className="text-primary/70" />
                        <span className="truncate">{s.location}</span>
                      </div>
                      <div className="flex justify-between items-center pt-2 mt-1 border-t border-gray-50">
                        <span className="text-sm font-bold text-primary">{s.price}</span>
                        <ArrowRight size={16} className="text-primary opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </section>

            {/* List Header */}
            <div>
              <h3 className="text-lg font-bold text-on-surface mb-4">Semua Tempat</h3>
              <div className="flex flex-col gap-5">
                {spots.map((s, idx) => (
                  <motion.div
                    key={s.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    onClick={() => onSelectSpot(s)}
                    className="premium-card p-3 flex gap-4 cursor-pointer group"
                  >
                    <div className="w-28 h-28 flex-shrink-0 bg-surface-dim rounded-xl overflow-hidden relative">
                      <img src={s.imageUrl} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700 ease-out" />
                      <div className="absolute top-2 left-2 bg-white/95 backdrop-blur-md text-on-surface px-1.5 py-0.5 rounded text-[10px] font-bold shadow-sm flex items-center gap-1">
                        <Star size={10} className="text-yellow-500 fill-yellow-500" /> {s.rating}
                      </div>
                    </div>
                    <div className="flex-1 flex flex-col justify-between py-1.5 pr-2">
                      <div>
                        <h3 className="font-bold text-base text-on-surface line-clamp-1 group-hover:text-primary transition-colors">{s.name}</h3>
                        <p className="text-xs text-on-surface-variant line-clamp-1 mt-1 font-medium flex items-center gap-1">
                          <MapPin size={12} className="text-primary/70 flex-shrink-0" />
                          {s.location}
                        </p>
                      </div>
                      <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-50">
                        <span className="text-sm font-bold text-primary">{s.price}</span>
                        <span className="text-[10px] font-bold text-tertiary bg-tertiary/10 px-2.5 py-1 rounded-full">{s.stats.crowd}</span>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="map"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="w-full h-[60vh] rounded-2xl overflow-hidden border border-outline-variant shadow-sm"
          >
            <MapView spots={spots} userLocation={userLocation} onSelectSpot={onSelectSpot} />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default function App() {
  const [currentPage, setCurrentPage] = useState<Page>('radar');
  const [selectedSpot, setSelectedSpot] = useState<Spot | null>(null);
  const [spots, setSpots] = useState<Spot[]>(MOCK_SPOTS);
  const [userLocation, setUserLocation] = useState<{ lat: number, lng: number } | null>(null);
  const [locationName, setLocationName] = useState<string>('Mencari Lokasi...');
  const [shareStatus, setShareStatus] = useState<string | null>(null);
  const [savedSpots, setSavedSpots] = useState<Spot[]>([]);

  const handleToggleSave = (spot: Spot) => {
    setSavedSpots(prev => {
      const isCurrentlySaved = prev.some(s => s.id === spot.id);
      if (isCurrentlySaved) {
        return prev.filter(s => s.id !== spot.id);
      } else {
        return [...prev, spot];
      }
    });
  };

  // Deep linking and URL sync
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const spotId = params.get('spotId');
    if (spotId) {
      const spot = spots.find(s => s.id === spotId);
      if (spot) {
        setSelectedSpot(spot);
        setCurrentPage('detail');
      }
    }

    const handlePopState = () => {
      const newParams = new URLSearchParams(window.location.search);
      const newSpotId = newParams.get('spotId');
      if (newSpotId) {
        const spot = spots.find(s => s.id === newSpotId);
        setSelectedSpot(spot || null);
        setCurrentPage(spot ? 'detail' : 'radar');
      } else {
        setSelectedSpot(null);
        setCurrentPage('radar');
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [spots]);

  useEffect(() => {
    const url = new URL(window.location.href);
    if (selectedSpot && currentPage === 'detail') {
      url.searchParams.set('spotId', selectedSpot.id);
    } else {
      url.searchParams.delete('spotId');
    }
    window.history.pushState({}, '', url);
  }, [selectedSpot, currentPage]);

  useEffect(() => {
    if (!("geolocation" in navigator)) {
      setLocationName('Akses Lokasi Tidak Tersedia');
      return;
    }

    const resolveLocationName = async (lat: number, lng: number) => {
      // 1. Try Google Maps Geocoder if available
      if ((window as any).google && (window as any).google.maps) {
        const geocoder = new (window as any).google.maps.Geocoder();
        try {
          const response = await new Promise<any>((resolve, reject) => {
            geocoder.geocode({ location: { lat, lng } }, (results: any, status: any) => {
              if (status === 'OK' && results[0]) resolve(results);
              else reject(status);
            });
          });

          if (response && response[0]) {
            const comps = response[0].address_components;
            const cityComp = comps.find((c: any) => c.types.includes('locality')) ||
                             comps.find((c: any) => c.types.includes('administrative_area_level_2'));

            if (cityComp) {
              const cityName = cityComp.long_name
                .replace(/Kabupaten /i, '')
                .replace(/Kota /i, '');
              setLocationName(cityName);
              return;
            }
          }
        } catch (e) {
          console.warn('Google Maps Geocoding failed, trying fallback...', e);
        }
      }

      // 2. Fallback to OpenStreetMap Nominatim
      try {
        const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=10`);
        const data = await response.json();
        if (data && data.address) {
          const city = data.address.city || data.address.town || data.address.county || data.address.state;
          if (city) {
            setLocationName(city.replace(/Kabupaten /i, '').replace(/Kota /i, ''));
            return;
          }
        }
      } catch (e) {
        console.warn('OSM Geocoding failed.', e);
      }

      // 3. Final Fallback to coordinates
      setLocationName(`Kordinat: ${lat.toFixed(2)}, ${lng.toFixed(2)}`);
    };

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const coords = {
          lat: position.coords.latitude,
          lng: position.coords.longitude
        };
        setUserLocation(coords);
        resolveLocationName(coords.lat, coords.lng);
      },
      (error) => {
        console.error("GPS_SYNC_FAILURE", error);
        if (!userLocation) {
          setLocationName('Lokasi Tidak Ditemukan');
        }
      },
      { 
        enableHighAccuracy: true, 
        maximumAge: 10000, 
        timeout: 10000 
      }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  // Force update location name if geocoding is stuck but we have coordinates
  useEffect(() => {
    if (userLocation && locationName === 'Mencari Lokasi...') {
      setLocationName(`Kordinat: ${userLocation.lat.toFixed(2)}, ${userLocation.lng.toFixed(2)}`);
    }
  }, [userLocation, locationName]);

  const handleUpdateSpot = (updatedSpot: Spot) => {
    setSpots(prev => prev.map(s => s.id === updatedSpot.id ? updatedSpot : s));
  };

  const handleSelectSpot = (s: Spot) => {
    setSelectedSpot(s);
    setCurrentPage('detail');
  };

  const handleShare = async () => {
    if (!selectedSpot) return;

    // Generate the URL with spotId param
    const shareUrl = `${window.location.origin}${window.location.pathname}?spotId=${selectedSpot.id}`;
    const shareData = {
      title: `Vibe Nongki by Vic: ${selectedSpot.name}`,
      text: `Titik Nongkrong: ${selectedSpot.name}\nLokasi: ${selectedSpot.location}\nKoordinat: ${selectedSpot.coordinates.lat}, ${selectedSpot.coordinates.lng}\nCek vibe-nya di sini:`,
      url: shareUrl
    };

    try {
      if (typeof navigator.share === 'function') {
        await navigator.share(shareData);
        setShareStatus('BERHASIL_DIBAGIKAN');
        setTimeout(() => setShareStatus(null), 3000);
      } else {
        await navigator.clipboard.writeText(shareUrl);
        setShareStatus('LINK_DISALIN');
        setTimeout(() => setShareStatus(null), 3000);
      }
    } catch (err) {
      console.warn('SHARE_ABORTED', err);
    }
  };

  return (
    <APIProvider apiKey={MAP_KEY || 'MISSING_KEY'} version="weekly">
      {/* Share Status Notification */}
      <AnimatePresence>
        {shareStatus && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="fixed bottom-24 sm:bottom-20 left-1/2 -translate-x-1/2 z-[100] bg-primary text-white px-6 py-3 rounded-full text-sm font-bold shadow-lg flex items-center gap-2"
          >
            {shareStatus === 'LINK_DISALIN' ? '📋 Tautan Disalin' : '✅ Berhasil Dibagikan'}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="min-h-screen bg-surface font-sans text-on-surface select-none">
        {!userLocation && (
          <div className="fixed inset-0 z-[100] bg-surface-bright flex flex-col items-center justify-center space-y-6">
            <div className="relative">
              <motion.div
                animate={{ scale: [1, 1.5, 1], opacity: [0.5, 0, 0.5] }}
                transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
                className="absolute inset-0 bg-primary/20 rounded-full"
              />
              <div className="w-20 h-20 bg-primary rounded-full flex items-center justify-center text-white shadow-lg relative z-10">
                <MapPin size={36} />
              </div>
            </div>
            <div className="text-center space-y-2 max-w-xs px-4">
              <h1 className="text-2xl font-bold text-on-surface">Mencari Lokasi</h1>
              <p className="text-sm text-on-surface-variant">Harap berikan izin akses lokasi agar kami bisa merekomendasikan tempat terbaik di sekitarmu.</p>
            </div>
          </div>
        )}

        {currentPage !== 'detail' && <TopAppBar onNavigateToAI={() => setCurrentPage('ai-finder')} />}

        <main className="relative z-10">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentPage}
              initial={{ opacity: 0, rotateY: 10, translateZ: -100 }}
              animate={{ opacity: 1, rotateY: 0, translateZ: 0 }}
              exit={{ opacity: 0, rotateY: -10, translateZ: -100 }}
              transition={{ type: "spring", damping: 20, stiffness: 100 }}
            >
              {currentPage === 'radar' && (
                <HomePage 
                  spots={spots} 
                  userLocation={userLocation} 
                  locationName={locationName} 
                  setLocationName={setLocationName}
                  onSelectSpot={handleSelectSpot} 
                  onNavigateToAI={() => setCurrentPage('ai-finder')} 
                />
              )}
              {currentPage === 'spots' && (
                <SpotsPage spots={spots} userLocation={userLocation} onSelectSpot={handleSelectSpot} />
              )}
              {currentPage === 'ai-finder' && <AIFinderPage spots={spots} userLocation={userLocation} locationName={locationName} onSelectSpot={handleSelectSpot} />}
              {currentPage === 'saved' && <SavedPage savedSpots={savedSpots} onSelectSpot={handleSelectSpot} />}
              {currentPage === 'detail' && selectedSpot && (
                <DetailPage
                  spot={spots.find(s => s.id === selectedSpot.id) || selectedSpot}
                  userLocation={userLocation}
                  onUpdateSpot={handleUpdateSpot}
                  onBack={() => {
                    setSelectedSpot(null);
                    setCurrentPage('radar');
                  }}
                  onShare={handleShare}
                  isSaved={savedSpots.some(s => s.id === selectedSpot.id)}
                  onToggleSave={handleToggleSave}
                />
              )}
            </motion.div>
          </AnimatePresence>
        </main>

        {currentPage !== 'detail' && (
          <BottomNavBar activePage={currentPage} setActivePage={setCurrentPage} />
        )}
      </div>
    </APIProvider>
  );
}
