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
import { fetchSpotsWithAutoGrow } from './lib/onDemandDatabase';

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
    imageUrls: ['https://images.unsplash.com/photo-1501339817302-38203b9f9fef?auto=format&fit=crop&w=800&q=80', 'https://images.unsplash.com/photo-1497935586351-b67a49e012bf?auto=format&fit=crop&w=800&q=80'],
    coordinates: { lat: -7.8185, lng: 112.0005 },
    stats: { crowd: 'Quiet', occupancy: 15, wifi: 'Tersedia' },
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
    stats: { crowd: 'Medium', occupancy: 65, wifi: 'Tersedia' },
    userReviews: []
  },
  {
    id: '3',
    name: 'Workhub Space',
    location: 'Kota, Kediri',
    distance: '0.8 km',
    vibe: 'Tenang & Fokus',
    rating: 4.9,
    reviews: 320,
    price: '$$',
    openUntil: '24 Jam',
    imageUrl: 'https://images.pexels.com/photos/302899/pexels-photo-302899.jpeg?auto=compress&cs=tinysrgb&w=800',
    imageUrls: ['https://images.pexels.com/photos/302899/pexels-photo-302899.jpeg?auto=compress&cs=tinysrgb&w=800'],
    coordinates: { lat: -7.8210, lng: 112.0105 },
    stats: { crowd: 'Busy', occupancy: 82, wifi: 'Tersedia' },
    userReviews: []
  },
  {
    id: '4',
    name: 'Taman Senja Outdoor',
    location: 'Pesantren, Kediri',
    distance: '3.4 km',
    vibe: 'Cozy Date',
    rating: 4.5,
    reviews: 142,
    price: '$',
    openUntil: '01:00',
    imageUrl: 'https://images.pexels.com/photos/1855214/pexels-photo-1855214.jpeg?auto=compress&cs=tinysrgb&w=800',
    imageUrls: ['https://images.pexels.com/photos/1855214/pexels-photo-1855214.jpeg?auto=compress&cs=tinysrgb&w=800'],
    coordinates: { lat: -7.8300, lng: 112.0300 },
    stats: { crowd: 'Medium', occupancy: 45, wifi: '' },
    userReviews: []
  },
  {
    id: '5',
    name: 'Warkop Pakde 24',
    location: 'Ngasem, Kediri',
    distance: '2.1 km',
    vibe: 'Ramai & Seru',
    rating: 4.3,
    reviews: 580,
    price: '$',
    openUntil: 'Buka 24 Jam',
    imageUrl: 'https://images.pexels.com/photos/312418/pexels-photo-312418.jpeg?auto=compress&cs=tinysrgb&w=800',
    imageUrls: ['https://images.pexels.com/photos/312418/pexels-photo-312418.jpeg?auto=compress&cs=tinysrgb&w=800'],
    coordinates: { lat: -7.8000, lng: 112.0500 },
    stats: { crowd: 'Busy', occupancy: 90, wifi: 'Tersedia' },
    userReviews: []
  }
];


// --- AI Functions ---
async function analyzeSentiment(text: string): Promise<'POSITIVE' | 'NEGATIVE' | 'NEUTRAL'> {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
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

const TopAppBar = ({ onNavigateToHome, onNavigateToAI, onNavigateToSpots }: { onNavigateToHome: () => void, onNavigateToAI: () => void, onNavigateToSpots: () => void }) => (
  <nav className="relative z-50 glass-header w-full h-[78px]">
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-full">
      <div className="flex items-center justify-between h-full">
        <button onClick={onNavigateToHome} className="flex items-center gap-3 text-left">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-orange-600 to-amber-500 flex items-center justify-center shadow-lg shadow-orange-500/20 rotate-3">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
              <path d="M4 8h12a2 2 0 0 1 2 2v1a5 5 0 0 1-5 5H7a3 3 0 0 1-3-3V8Z" stroke="white" strokeWidth="2" strokeLinecap="round"/>
              <path d="M16 10h2a2 2 0 0 1 2 2v1a2 2 0 0 1-2 2h-1" stroke="white" strokeWidth="2" strokeLinecap="round"/>
              <path d="M6 8V6a2 2 0 0 1 2-2h2" stroke="white" strokeWidth="2" strokeLinecap="round" opacity="0.7"/>
            </svg>
          </div>
          <div>
            <span className="text-[22px] font-extrabold tracking-tight text-zinc-900">Vibe<span className="gradient-text">Nongky</span></span>
            <div className="-mt-1.5 text-[10px] font-semibold tracking-widest text-orange-600/80 uppercase">Cari • Nongkrong • Vibe</div>
          </div>
        </button>

        <div className="hidden lg:flex items-center gap-8">
          <button onClick={onNavigateToHome} className="text-[15px] font-medium text-zinc-700 hover:text-black transition">Beranda</button>
          <button onClick={onNavigateToSpots} className="text-[15px] font-medium text-zinc-700 hover:text-black transition">Jelajah</button>
          <a href="#" className="text-[15px] font-medium text-zinc-700 hover:text-black transition">Kategori</a>
          <a href="#" className="text-[15px] font-medium text-zinc-700 hover:text-black transition">Kota</a>
          <a href="#" className="text-[15px] font-medium text-zinc-700 hover:text-black transition">Untuk Owner</a>
        </div>

        <div className="flex items-center gap-3">
          <button onClick={onNavigateToAI} className="hidden sm:flex items-center gap-2 text-[14px] font-semibold px-4 h-10 rounded-xl hover:bg-zinc-900/5 transition text-zinc-700">
            <Sparkles size={18} />
            Tanya AI
          </button>
          <button onClick={onNavigateToAI} className="h-10 px-5 rounded-xl bg-zinc-900 text-white text-[14px] font-semibold hover:bg-zinc-800 active:scale-[0.98] transition shadow-lg shadow-zinc-900/20">
            Cari Cepat
          </button>
        </div>
      </div>
    </div>
  </nav>
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
              <div className={`relative flex items-center justify-center transition-all ${isActive ? 'text-orange-600' : 'text-zinc-500 group-hover:text-orange-600/70'}`}>
                {isActive && (
                  <motion.div
                    layoutId="nav-pill"
                    className="absolute inset-0 bg-orange-600/10 rounded-full w-12 h-8 -mx-3 -my-1.5"
                    transition={{ type: 'spring', bounce: 0.2, duration: 0.6 }}
                  />
                )}
                <Icon size={22} strokeWidth={isActive ? 2.5 : 2} className="relative z-10" />
              </div>
              <span className={`text-[10px] font-semibold transition-colors ${isActive ? 'text-orange-600' : 'text-zinc-500'}`}>
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

// --- Radar UI Components ---

const RadarPing = ({ spot, angle, radius }: { spot: Spot, angle: number, radius: number }) => {
  const x = radius * Math.cos((angle * Math.PI) / 180);
  const y = radius * Math.sin((angle * Math.PI) / 180);

  return (
    <motion.div
      style={{
        left: `${50 + x}%`,
        top: `${50 + y}%`,
        transformStyle: 'preserve-3d'
      }}
      initial={{ scale: 0, opacity: 0, translateZ: 0 }}
      animate={{ 
        scale: 1, 
        opacity: 1, 
        translateZ: [20, 40, 20],
        rotateY: [0, 10, 0]
      }}
      transition={{
        translateZ: { repeat: Infinity, duration: 2, ease: "easeInOut" },
        rotateY: { repeat: Infinity, duration: 3, ease: "easeInOut" }
      }}
      className="absolute z-30 cursor-pointer group/ping preserve-3d"
    >
      <div className="relative">
        <div className="w-4 h-4 bg-cyan-400 rounded-full ping-active neon-glow-cyan" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-10 h-10 rounded-full border border-cyan-400/40 scale-0 group-hover/ping:scale-150 transition-transform duration-500" />

        {/* Hover Tip */}
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-4 p-4 bg-surface-bright/90 backdrop-blur-md border border-cyan-400/30 opacity-0 group-hover/ping:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50 shadow-[0_20px_50px_rgba(0,0,0,0.8)] skew-x-[-6deg] preserve-3d" style={{ transform: 'translateZ(100px)' }}>
          <span className="label-mono block text-[8px] opacity-40 mb-1">NODE_IDENTIFIED</span>
          <p className="heading-bold text-sm hologram-text">{spot.name}</p>
          <div className="flex items-center gap-2 mt-2">
            <div className="w-1.5 h-1.5 bg-pink-500 rounded-full animate-pulse shadow-[0_0_8px_pink]" />
            <span className="label-mono text-[7px] text-pink-500">{spot.stats.crowd.toUpperCase()}</span>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

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
  const [searchQuery, setSearchQuery] = useState('');
  const placesLib = useMapsLibrary('places');

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
            distance: 'Dekat',
            vibe: 'Cozy',
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [placesLib, userLocation, activeCategory]);

  const displaySpots = nearbyResults.length > 0 ? nearbyResults : spots;
  const showcaseSpot = displaySpots[0] || spots[0];

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onNavigateToAI();
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 lg:pt-32 pb-32"
    >
      <div className="grid lg:grid-cols-2 gap-12 lg:gap-8 items-center">
        {/* Left */}
        <div className="relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white border border-orange-200 shadow-sm mb-6">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
            <span className="text-xs font-semibold text-zinc-700">{displaySpots.length > 0 ? displaySpots.length * 123 : '2,547'} tempat nongkrong aktif hari ini</span>
          </div>

          <h1 className="text-[42px] sm:text-[56px] lg:text-[68px] font-extrabold leading-[0.95] tracking-[-0.02em] text-zinc-900">
            Temukan Tempat
            <span className="block gradient-text pb-2 -mb-2">Nongkrong</span>
            <span className="block">Paling Vibe.</span>
          </h1>
          
          <p className="mt-5 text-[17px] sm:text-[18px] leading-relaxed text-zinc-600 max-w-xl">
            Dari warkop hidden gem 15 ribuan, cafe estetik buat WFC, sampai warung kopi yang buka sampai pagi. Filter by vibe, bukan cuma rating. Lokasi Anda: <span className="font-bold">{locationName.replace('.OS', '')}</span>.
          </p>

          {/* Search */}
          <div className="mt-8 relative">
            <div className="relative bg-white rounded-[20px] shadow-[0_20px_60px_-15px_rgba(234,88,12,0.25)] border border-zinc-200 p-2">
              <form onSubmit={handleSearchSubmit} className="flex flex-col sm:flex-row gap-2">
                <div className="flex-1 flex items-center gap-3 pl-4 pr-2 h-[56px] bg-zinc-50 rounded-[14px] border border-zinc-100">
                  <svg className="shrink-0 text-zinc-400" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
                  <input 
                    type="text" 
                    placeholder="Cari 'cafe WFC di Bandung'..." 
                    className="w-full bg-transparent outline-none text-[15px] placeholder:text-zinc-400 font-medium text-zinc-900"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                <div className="flex gap-2">
                  <button type="button" onClick={() => { setActiveCategory('Semua'); }} className="h-[56px] px-4 rounded-[14px] bg-zinc-900/5 hover:bg-zinc-900/10 text-zinc-700 font-semibold text-[14px] flex items-center gap-2 transition whitespace-nowrap">
                    <MapPin size={18} />
                    <span className="hidden sm:inline">Sekitar</span>
                  </button>
                  <button type="submit" className="h-[56px] px-7 rounded-[14px] bg-gradient-to-b from-orange-600 to-orange-700 text-white font-bold text-[15px] shadow-lg shadow-orange-600/25 hover:shadow-orange-600/30 hover:-translate-y-[1px] active:translate-y-[0px] transition">
                    Cari
                  </button>
                </div>
              </form>
            </div>

            {/* Quick filters */}
            <div className="flex flex-wrap gap-2 mt-4">
              <button onClick={() => setActiveCategory('Cafe')} className={`vibe-chip group flex items-center gap-1.5 px-3.5 h-9 rounded-full border transition text-[13px] font-semibold ${activeCategory === 'Cafe' ? 'bg-orange-600 text-white border-orange-600' : 'bg-white border-zinc-200 hover:border-orange-300 hover:bg-orange-50 text-zinc-700'}`}>
                <span>💻</span> Cafe WFC
              </button>
              <button onClick={() => setActiveCategory('Warung')} className={`vibe-chip group flex items-center gap-1.5 px-3.5 h-9 rounded-full border transition text-[13px] font-semibold ${activeCategory === 'Warung' ? 'bg-orange-600 text-white border-orange-600' : 'bg-white border-zinc-200 hover:border-orange-300 hover:bg-orange-50 text-zinc-700'}`}>
                <span>💸</span> Murah Meriah
              </button>
              <button onClick={() => setActiveCategory('Restoran')} className={`vibe-chip group flex items-center gap-1.5 px-3.5 h-9 rounded-full border transition text-[13px] font-semibold ${activeCategory === 'Restoran' ? 'bg-orange-600 text-white border-orange-600' : 'bg-white border-zinc-200 hover:border-orange-300 hover:bg-orange-50 text-zinc-700'}`}>
                <span>🍽️</span> Restoran
              </button>
            </div>
          </div>

          {/* Social proof */}
          <div className="mt-10 flex flex-wrap items-center gap-6">
            <div className="flex -space-x-3">
              <img src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=80" className="w-9 h-9 rounded-full border-2 border-white object-cover" alt="" />
              <img src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=80" className="w-9 h-9 rounded-full border-2 border-white object-cover" alt="" />
              <img src="https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=80" className="w-9 h-9 rounded-full border-2 border-white object-cover" alt="" />
              <div className="w-9 h-9 rounded-full border-2 border-white bg-zinc-900 text-white grid place-items-center text-[11px] font-bold">99+</div>
            </div>
            <div className="text-[13px] leading-snug">
              <div className="flex items-center gap-1">
                <span className="text-amber-500">★★★★★</span>
                <span className="font-bold text-zinc-900">4.9/5</span>
              </div>
              <div className="text-zinc-500 font-medium">dari {displaySpots.length > 0 ? displaySpots.length * 147 : '12.847'} review</div>
            </div>
            <div className="hidden sm:flex items-center gap-3 pl-6 border-l border-zinc-200">
              <div className="text-center">
                <div className="text-[20px] font-extrabold leading-none text-zinc-900">50+</div>
                <div className="text-[11px] text-zinc-500 font-medium">Kota</div>
              </div>
              <div className="text-center">
                <div className="text-[20px] font-extrabold leading-none text-zinc-900">2.5k</div>
                <div className="text-[11px] text-zinc-500 font-medium">Tempat</div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Visual */}
        <div className="relative lg:h-[640px] flex items-center justify-center">
          {/* Phone mockup */}
          <div className="relative z-20 w-[320px] sm:w-[360px] cursor-pointer" onClick={() => onSelectSpot(showcaseSpot)}>
            <div className="relative bg-zinc-900 rounded-[44px] p-2.5 shadow-[0_50px_100px_-20px_rgba(0,0,0,0.3)] hover:scale-[1.02] transition-transform duration-300">
              <div className="bg-white rounded-[36px] overflow-hidden">
                <div className="h-[32px] bg-zinc-50 flex items-center justify-center">
                  <div className="w-20 h-1.5 bg-zinc-900 rounded-full"></div>
                </div>
                <img src={showcaseSpot.imageUrl} className="w-full h-[220px] object-cover" alt="cafe" />
                <div className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-bold text-[18px] leading-tight text-zinc-900 line-clamp-1">{showcaseSpot.name}</h3>
                      <p className="text-[13px] text-zinc-500 mt-0.5 line-clamp-1">{showcaseSpot.location} • {showcaseSpot.price}</p>
                    </div>
                    <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-amber-50 border border-amber-200 shrink-0">
                      <span className="text-amber-500 text-[14px]">★</span>
                      <span className="text-[13px] font-bold text-amber-700">{showcaseSpot.rating}</span>
                    </div>
                  </div>
                  <div className="flex gap-1.5 mt-3 flex-wrap">
                    <span className="px-2.5 py-1 rounded-full bg-zinc-900 text-white text-[11px] font-semibold">{showcaseSpot.stats.crowd}</span>
                    <span className="px-2.5 py-1 rounded-full bg-green-50 text-green-700 border border-green-200 text-[11px] font-semibold">{showcaseSpot.openUntil}</span>
                    <span className="px-2.5 py-1 rounded-full bg-zinc-100 text-zinc-700 text-[11px] font-semibold">WiFi {showcaseSpot.stats.wifi}</span>
                  </div>
                  <div className="mt-4 grid grid-cols-3 gap-2">
                    {(showcaseSpot.imageUrls.length > 1 ? showcaseSpot.imageUrls.slice(1, 4) : [showcaseSpot.imageUrl, showcaseSpot.imageUrl, showcaseSpot.imageUrl]).map((img, i) => (
                      <img key={i} src={img} className="h-[70px] w-full object-cover rounded-xl" alt="" />
                    ))}
                  </div>
                </div>
              </div>
            </div>
            
            {/* Floating cards */}
            <div className="absolute -left-16 sm:-left-24 top-16 card-float pointer-events-none">
              <div className="bg-white/90 glass border border-zinc-200 rounded-2xl shadow-xl px-4 py-3 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 grid place-items-center text-white shadow-lg">
                  <Sparkles size={20} />
                </div>
                <div>
                  <div className="text-[11px] text-zinc-500 font-medium">Vibe Check</div>
                  <div className="text-[14px] font-bold -mt-0.5 text-zinc-900">{showcaseSpot.stats.crowd}</div>
                </div>
              </div>
            </div>

            <div className="absolute -right-10 sm:-right-16 top-1/2 -translate-y-1/2 card-float card-float-2 pointer-events-none">
              <div className="bg-white/90 glass border border-zinc-200 rounded-2xl shadow-xl px-4 py-3">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                  <span className="text-[12px] font-bold text-zinc-900">Live: {showcaseSpot.stats.occupancy}% penuh</span>
                </div>
                <div className="mt-1.5 flex -space-x-1.5">
                  <img src="https://i.pravatar.cc/24?img=1" className="w-6 h-6 rounded-full border-2 border-white" alt="" />
                  <img src="https://i.pravatar.cc/24?img=2" className="w-6 h-6 rounded-full border-2 border-white" alt="" />
                  <img src="https://i.pravatar.cc/24?img=3" className="w-6 h-6 rounded-full border-2 border-white" alt="" />
                </div>
              </div>
            </div>

            <div className="absolute -left-8 sm:-left-12 bottom-20 card-float card-float-3 pointer-events-none">
              <div className="bg-zinc-900 text-white rounded-2xl shadow-2xl px-4 py-3">
                <div className="text-[11px] opacity-70">Harga Rata-rata</div>
                <div className="text-[20px] font-extrabold leading-none mt-0.5 text-white">{showcaseSpot.price === '$$' ? 'Rp 35rb' : showcaseSpot.price === '$' ? 'Rp 15rb' : 'Rp 75rb'}</div>
                <div className="text-[11px] text-emerald-400 font-semibold mt-1">✓ WiFi Tersedia</div>
              </div>
            </div>
          </div>

          {/* Background cafe cards */}
          <div className="absolute inset-0 -z-10 hidden lg:block">
            <div className="absolute right-[-40px] top-10 w-[200px] rotate-[8deg] opacity-60">
              <img src={displaySpots[1]?.imageUrl || "https://images.unsplash.com/photo-1521017432531-fbd92d768814?q=80&w=600"} className="w-full h-[260px] object-cover rounded-[28px] shadow-2xl" alt="" />
            </div>
            <div className="absolute left-[-30px] bottom-10 w-[180px] rotate-[-6deg] opacity-50">
              <img src={displaySpots[2]?.imageUrl || "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?q=80&w=600"} className="w-full h-[240px] object-cover rounded-[28px] shadow-2xl" alt="" />
            </div>
          </div>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="mt-16 lg:mt-8 border-t border-zinc-200/70 pt-6 flex flex-wrap items-center justify-between gap-4 text-[13px] text-zinc-500">
        <div className="flex items-center gap-5">
          <span className="font-semibold text-zinc-700">Terintegrasi dengan:</span>
          <div className="flex items-center gap-4 opacity-70 grayscale hover:grayscale-0 transition">
            <MapIcon size={20} className="text-zinc-900" />
            <span className="font-bold text-zinc-900">Google Maps</span>
            <span className="font-bold text-zinc-900">Gojek</span>
            <span className="font-bold text-zinc-900">Grab</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
          <span>Update realtime • Buka/tutup akurat</span>
        </div>
      </div>
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
        textQuery: query,
        fields: ['id', 'displayName', 'location', 'formattedAddress', 'rating', 'userRatingCount', 'priceLevel', 'photos', 'reviews'],
        maxResultCount: 20,
        rankPreference: 'DISTANCE'
      };

      if (userLocation) {
        searchOptions.locationBias = {
          center: userLocation,
          radius: 20000
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
            <div className="w-full sm:w-32 h-40 sm:h-32 flex-shrink-0 bg-surface-dim rounded-xl overflow-hidden relative transform-gpu">
              <img src={spot.imageUrl} alt={spot.name} className="w-full h-full object-cover transform-gpu group-hover:scale-110 transition-transform duration-500" />
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
              <div className="w-28 h-28 flex-shrink-0 bg-surface-dim rounded-xl overflow-hidden relative transform-gpu">
                <img src={spot.imageUrl} alt={spot.name} className="w-full h-full object-cover transform-gpu group-hover:scale-110 transition-transform duration-700 ease-out" />
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
          model: "gemini-2.5-flash",
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
      <header className="fixed top-0 left-0 w-full z-[70] glass-header px-4 h-20 flex items-center justify-between pb-2">
        <button onClick={onBack} className="w-10 h-10 btn-3d text-on-surface">
          <ChevronLeft size={24} />
        </button>
        <span className="font-bold text-on-surface truncate px-4">{spot.name}</span>
        <div className="flex items-center gap-3">
          <button onClick={onShare} className="w-10 h-10 btn-3d"><Share2 size={18} className="text-on-surface" /></button>
          <button onClick={() => onToggleSave(spot)} className="w-10 h-10 btn-3d">
            <Bookmark size={18} className={`transition-colors ${isSaved ? 'text-primary fill-primary' : 'text-on-surface'}`} />
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto pt-16">
        {/* Photo Gallery */}
        <section className="relative z-0 w-full h-[300px] sm:h-[450px] bg-[#0a0a0a] overflow-hidden shadow-sm flex items-center justify-center pb-6">
          <AnimatePresence mode="wait">
            <motion.img
              key={currentPhotoIndex}
              src={spot.imageUrls[currentPhotoIndex]}
              alt={`${spot.name} - ${currentPhotoIndex + 1}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="w-full h-full object-contain"
            />
          </AnimatePresence>

          <div className="absolute bottom-10 right-4 z-30 bg-white/20 text-white px-3.5 py-1.5 rounded-full text-xs font-bold backdrop-blur-md shadow-lg border border-white/10">
            {currentPhotoIndex + 1} / {spot.imageUrls.length}
          </div>

          {spot.imageUrls.length > 1 && (
            <>
              <button onClick={prevPhoto} className="absolute z-30 left-4 top-1/2 -translate-y-1/2 w-12 h-12 bg-white/10 text-white rounded-full flex items-center justify-center backdrop-blur-md hover:bg-white/20 border border-white/20 transition-all shadow-lg active:scale-95">
                <ChevronLeft size={26} />
              </button>
              <button onClick={nextPhoto} className="absolute z-30 right-4 top-1/2 -translate-y-1/2 w-12 h-12 bg-white/10 text-white rounded-full flex items-center justify-center backdrop-blur-md hover:bg-white/20 border border-white/20 transition-all shadow-lg active:scale-95">
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

const SpotsPage = ({ spots, userLocation, locationName, onSelectSpot }: { spots: Spot[], userLocation: { lat: number, lng: number } | null, locationName: string, onSelectSpot: (s: Spot) => void }) => {
  const [viewMode, setViewMode] = useState<'grid' | 'map'>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('');
  const [activeVibes, setActiveVibes] = useState<string[]>([]);
  const [priceRange, setPriceRange] = useState<number>(75);
  const [activeFacilities, setActiveFacilities] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState<string>('Paling Relevan');
  const [displaySpots, setDisplaySpots] = useState<Spot[]>(spots);

  const toggleArrayItem = (setter: React.Dispatch<React.SetStateAction<string[]>>, item: string) => {
      setter(prev => prev.includes(item) ? prev.filter(i => i !== item) : [...prev, item]);
  };

  useEffect(() => {
    let filtered = [...spots];
    
    // Quick filter
    if (activeFilter === 'wfc') filtered = filtered.filter(s => s.name.toLowerCase().includes('kopi') || s.stats?.wifi);
    if (activeFilter === 'murah') filtered = filtered.filter(s => s.price === '$');
    if (activeFilter === '24jam') filtered = filtered.filter(s => s.openUntil?.includes('24') || s.openUntil?.includes('Buka'));
    if (activeFilter === 'outdoor') filtered = filtered.filter(s => s.name.toLowerCase().includes('taman') || s.location.toLowerCase().includes('alam'));
    if (activeFilter === 'live') filtered = filtered.filter(s => s.stats?.occupancy > 50);

    // Search query
    if (searchQuery) {
      filtered = filtered.filter(s => s.name.toLowerCase().includes(searchQuery.toLowerCase()) || s.location.toLowerCase().includes(searchQuery.toLowerCase()));
    }

    // Sidebar Vibes
    if (activeVibes.length > 0) {
       filtered = filtered.filter(s => activeVibes.some(v => s.vibe?.includes(v) || s.stats?.crowd?.includes(v) || s.stats?.crowd?.includes('Quiet') || s.stats?.crowd?.includes('Busy')));
    }

    // Sidebar Facilities
    if (activeFacilities.length > 0) {
       if (activeFacilities.includes('WiFi')) filtered = filtered.filter(s => s.stats?.wifi);
       if (activeFacilities.includes('AC')) filtered = filtered.filter(s => s.rating >= 4.0);
    }

    // Sorting
    if (sortBy === 'Rating Tertinggi') {
       filtered.sort((a, b) => b.rating - a.rating);
    } else if (sortBy === 'Terdekat') {
       filtered.sort((a, b) => parseFloat(a.distance || '0') - parseFloat(b.distance || '0'));
    } else if (sortBy === 'Paling Ramai') {
       filtered.sort((a, b) => (b.stats?.occupancy || 0) - (a.stats?.occupancy || 0));
    }

    setDisplaySpots(filtered);
  }, [searchQuery, activeFilter, activeVibes, activeFacilities, sortBy, priceRange, spots]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-8 pt-24 lg:pt-32 pb-32"
    >
        {/* Top Bar */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6 relative z-10">
            <div>
                <div className="flex items-center gap-2 mb-2">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-green-50 text-green-700 text-[11px] font-medium border border-green-200">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
                        {displaySpots.length > 0 ? displaySpots.length * 123 : 0} tempat aktif hari ini
                    </span>
                    <span className="text-[13px] text-zinc-500">• Lokasi: <b className="text-zinc-900">{locationName.replace('.OS', '')}</b></span>
                </div>
                <h1 className="text-[32px] sm:text-[40px] font-extrabold leading-[1.1] tracking-tight text-zinc-900">
                    Jelajah Tempat <span className="text-orange-600">Nongkrong</span>
                </h1>
                <p className="text-[14px] text-zinc-500 mt-1.5">Filter by vibe, bukan cuma rating. Temukan yang pas buat mood kamu.</p>
            </div>
            <div className="flex items-center gap-2">
                <button onClick={() => setViewMode('grid')} className={`w-9 h-9 grid place-items-center rounded-xl transition ${viewMode === 'grid' ? 'bg-zinc-900 text-white' : 'hover:bg-black/5 text-zinc-500'}`}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
                </button>
                <button onClick={() => setViewMode('map')} className={`w-9 h-9 grid place-items-center rounded-xl transition ${viewMode === 'map' ? 'bg-zinc-900 text-white' : 'hover:bg-black/5 text-zinc-500'}`}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21"/><line x1="9" y1="3" x2="9" y2="21"/><line x1="15" y1="3" x2="15" y2="21"/></svg>
                </button>
                <div className="w-px h-6 bg-black/10 mx-1"></div>
                <button className="px-3.5 py-2 rounded-xl border border-black/10 hover:bg-black/5 text-[13px] font-medium flex items-center gap-1.5 text-zinc-700">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="21" y1="4" x2="14" y2="4"/><line x1="10" y1="4" x2="3" y2="4"/><line x1="21" y1="12" x2="12" y2="12"/><line x1="8" y1="12" x2="3" y2="12"/><line x1="21" y1="20" x2="16" y2="20"/><line x1="12" y1="20" x2="3" y2="20"/><line x1="14" y1="1" x2="14" y2="7"/><line x1="8" y1="9" x2="8" y2="15"/><line x1="16" y1="17" x2="16" y2="23"/></svg>
                    Urutkan
                </button>
            </div>
        </div>

        {/* Search Bar */}
        <div className="bg-white/80 glass rounded-[20px] border border-black/10 p-3 shadow-[0_8px_24px_rgba(0,0,0,0.06)] mb-6 relative z-10">
            <div className="flex flex-col sm:flex-row gap-2.5">
                <div className="flex-1 relative">
                    <svg className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
                    <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} type="text" placeholder="Cari 'cafe WFC di Bandung', 'warkop 24 jam'..." className="w-full h-11 pl-10 pr-3 rounded-xl bg-zinc-50 border border-transparent focus:border-orange-600/30 focus:bg-white focus:outline-none text-[14px] text-zinc-900" />
                </div>
                <div className="flex gap-2">
                    <button className="h-11 px-3.5 rounded-xl bg-zinc-50 hover:bg-zinc-100 text-[13px] font-medium flex items-center gap-1.5 whitespace-nowrap text-zinc-700 transition">
                        <MapPin size={14} />
                        Sekitar
                    </button>
                    <button className="h-11 px-5 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-[14px] font-semibold shadow-[0_4px_12px_rgba(255,107,44,0.25)] transition">
                        Cari
                    </button>
                </div>
            </div>
            {/* Quick filters */}
            <div className="flex items-center gap-2 mt-3 overflow-x-auto scrollbar-hide">
                {[
                  { id: 'wfc', emoji: '💻', label: 'Cafe WFC' },
                  { id: 'murah', emoji: '💸', label: 'Murah Meriah' },
                  { id: '24jam', emoji: '🌙', label: 'Buka 24 Jam' },
                  { id: 'estetik', emoji: '📸', label: 'Estetik' },
                  { id: 'outdoor', emoji: '🌿', label: 'Outdoor' },
                  { id: 'live', emoji: '🔴', label: 'Live Ramai' }
                ].map(f => (
                  <button key={f.id} onClick={() => setActiveFilter(activeFilter === f.id ? '' : f.id)} className={`px-3 py-1.5 rounded-full text-[12px] font-medium whitespace-nowrap flex items-center gap-1.5 transition ${activeFilter === f.id ? 'bg-zinc-900 text-white' : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-700'}`}>
                      <span>{f.emoji}</span> {f.label}
                  </button>
                ))}
            </div>
        </div>

        <div className="grid lg:grid-cols-[280px_1fr] gap-6 relative z-10">
            {/* Sidebar Filters */}
            <aside className="hidden lg:block">
                <div className="sticky top-[100px] space-y-4">
                    {/* Vibe Filter */}
                    <div className="bg-white rounded-[20px] border border-black/10 p-4 shadow-sm">
                        <h3 className="font-semibold text-[14px] mb-3 flex items-center gap-2 text-zinc-900">
                            <span className="w-6 h-6 grid place-items-center rounded-lg bg-orange-50 text-orange-600">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M2 6c.6 0 1.2-.2 1.6-.6C4 5 4.6 5 5 5s1 .2 1.4.6c.4.4 1 .6 1.6.6.6 0 1.2-.2 1.6-.6C10 5 10.6 5 11 5s1 .2 1.4.6c.4.4 1 .6 1.6.6.6 0 1.2-.2 1.6-.6C16 5 16.6 5 17 5s1 .2 1.4.6c.4.4 1 .6 1.6.6.6 0 1.2-.2 1.6-.6C22 5 22.6 5 23 5"/><path d="M2 12c.6 0 1.2-.2 1.6-.6C4 11 4.6 11 5 11s1 .2 1.4.6c.4.4 1 .6 1.6.6.6 0 1.2-.2 1.6-.6C10 11 10.6 11 11 11s1 .2 1.4.6c.4.4 1 .6 1.6.6.6 0 1.2-.2 1.6-.6C16 11 16.6 11 17 11s1 .2 1.4.6c.4.4 1 .6 1.6.6.6 0 1.2-.2 1.6-.6C22 11 22.6 11 23 11"/><path d="M2 18c.6 0 1.2-.2 1.6-.6C4 17 4.6 17 5 17s1 .2 1.4.6c.4.4 1 .6 1.6.6.6 0 1.2-.2 1.6-.6C10 17 10.6 17 11 17s1 .2 1.4.6c.4.4 1 .6 1.6.6.6 0 1.2-.2 1.6-.6C16 17 16.6 17 17 17s1 .2 1.4.6c.4.4 1 .6 1.6.6.6 0 1.2-.2 1.6-.6C22 17 22.6 17 23 17"/></svg>
                            </span>
                            Vibe Check
                        </h3>
                        <div className="space-y-2.5">
                          {['Tenang & Fokus', 'Ramai & Seru', 'Cozy Date', 'Nugas / WFC'].map((vibe, i) => (
                            <label key={vibe} className="flex items-center justify-between cursor-pointer group">
                                <div className="flex items-center gap-2.5">
                                    <input type="checkbox" checked={activeVibes.includes(vibe)} onChange={() => toggleArrayItem(setActiveVibes, vibe)} className="w-4 h-4 rounded border-2 text-orange-600 focus:ring-orange-600/20" />
                                    <span className="text-[13px] text-zinc-700">{vibe}</span>
                                </div>
                                <span className="text-[11px] text-zinc-400">{300 + i * 42}</span>
                            </label>
                          ))}
                        </div>
                    </div>

                    {/* Harga */}
                    <div className="bg-white rounded-[20px] border border-black/10 p-4 shadow-sm">
                        <h3 className="font-semibold text-[14px] mb-3 text-zinc-900">Harga Rata-rata</h3>
                        <div className="flex items-center gap-2">
                            <button onClick={() => setPriceRange(25)} className={`px-3 py-1.5 rounded-lg text-[12px] font-semibold border transition ${priceRange <= 25 ? 'bg-orange-50 text-orange-600 border-orange-600/20' : 'hover:bg-zinc-50 text-zinc-700 border-transparent'}`}>&lt; 25rb</button>
                            <button onClick={() => setPriceRange(50)} className={`px-3 py-1.5 rounded-lg text-[12px] font-semibold border transition ${priceRange > 25 && priceRange <= 50 ? 'bg-orange-50 text-orange-600 border-orange-600/20' : 'hover:bg-zinc-50 text-zinc-700 border-transparent'}`}>25-50rb</button>
                            <button onClick={() => setPriceRange(75)} className={`px-3 py-1.5 rounded-lg text-[12px] font-semibold border transition ${priceRange > 50 ? 'bg-orange-50 text-orange-600 border-orange-600/20' : 'hover:bg-zinc-50 text-zinc-700 border-transparent'}`}>50rb+</button>
                        </div>
                        <div className="mt-3 pt-3 border-t border-black/5">
                            <div className="flex items-center justify-between mb-1.5">
                                <span className="text-[12px] text-zinc-500">Range</span>
                                <span className="text-[12px] font-medium text-zinc-900">Rp 15rb - Rp {priceRange}rb</span>
                            </div>
                            <input type="range" min="15" max="100" value={priceRange} onChange={e => setPriceRange(parseInt(e.target.value))} className="w-full accent-orange-600" />
                        </div>
                    </div>

                    {/* Fasilitas */}
                    <div className="bg-white rounded-[20px] border border-black/10 p-4 shadow-sm">
                        <h3 className="font-semibold text-[14px] mb-3 text-zinc-900">Fasilitas</h3>
                        <div className="grid grid-cols-2 gap-2">
                          {['WiFi', 'Stopkontak', 'AC', 'Parkir', 'Mushola', 'Outdoor'].map((fas, i) => (
                            <label key={fas} className="flex items-center gap-1.5 cursor-pointer">
                                <input type="checkbox" checked={activeFacilities.includes(fas)} onChange={() => toggleArrayItem(setActiveFacilities, fas)} className="w-3.5 h-3.5 rounded text-orange-600" />
                                <span className="text-[12px] text-zinc-700">{fas}</span>
                            </label>
                          ))}
                        </div>
                    </div>

                    {/* Live */}
                    <div className="bg-gradient-to-br from-zinc-900 to-zinc-800 rounded-[20px] p-4 text-white shadow-lg">
                        <div className="flex items-center gap-2 mb-2">
                            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
                            <h3 className="font-semibold text-[13px]">Live Sekarang</h3>
                        </div>
                        <p className="text-[12px] text-white/70 mb-3">{displaySpots.length * 2} tempat lagi rame di sekitarmu</p>
                        <button className="w-full py-2 rounded-xl bg-white/10 hover:bg-white/15 backdrop-blur text-[12px] font-medium border border-white/10 transition">
                            Lihat yang rame
                        </button>
                    </div>
                </div>
            </aside>

            {/* Main Content */}
            <div>
                {/* Stats Bar */}
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-4">
                        <p className="text-[13px] text-zinc-500"><b className="text-zinc-900">{displaySpots.length}</b> tempat ditemukan</p>
                        <div className="hidden sm:flex items-center gap-1.5">
                            <div className="flex -space-x-1.5">
                                <img src="https://i.pravatar.cc/24?img=1" className="w-6 h-6 rounded-full border-2 border-white" alt="" />
                                <img src="https://i.pravatar.cc/24?img=2" className="w-6 h-6 rounded-full border-2 border-white" alt="" />
                                <img src="https://i.pravatar.cc/24?img=3" className="w-6 h-6 rounded-full border-2 border-white" alt="" />
                            </div>
                            <span className="text-[12px] text-zinc-500">99+ lagi jelajah</span>
                        </div>
                    </div>
                    <select value={sortBy} onChange={e => setSortBy(e.target.value)} className="text-[12px] bg-transparent border-0 focus:ring-0 font-medium text-zinc-700 outline-none">
                        <option>Paling Relevan</option>
                        <option>Terdekat</option>
                        <option>Rating Tertinggi</option>
                        <option>Paling Ramai</option>
                    </select>
                </div>

                {/* Grid */}
                <AnimatePresence mode="wait">
                  {viewMode === 'grid' ? (
                    <motion.div key="grid" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4 pb-12">
                      {displaySpots.map((spot, i) => (
                        <article key={spot.id} onClick={() => onSelectSpot(spot)} className={`vibe-card group cursor-pointer relative bg-white rounded-[24px] border border-black/10 overflow-hidden ${i === 0 ? 'sm:col-span-2 xl:col-span-2' : ''}`}>
                            {i === 0 ? (
                              <>
                                <div className="absolute top-3 left-3 z-10 flex gap-1.5">
                                    <span className="px-2.5 py-1 rounded-full bg-orange-600 text-white text-[11px] font-semibold shadow-lg">Vibe Check: Tinggi</span>
                                    <span className="px-2.5 py-1 rounded-full bg-black/70 backdrop-blur text-white text-[11px] font-medium">Live: {spot.stats.occupancy}% penuh</span>
                                </div>
                                <div className="grid md:grid-cols-[1.1fr_0.9fr]">
                                    <div className="relative h-[240px] md:h-full min-h-[260px] overflow-hidden">
                                        <img src={spot.imageUrl} className="w-full h-full object-cover group-hover:scale-105 transition duration-700" alt="" />
                                        <div className="absolute bottom-3 left-3 right-3 flex gap-1.5">
                                            {(spot.imageUrls.length > 1 ? spot.imageUrls.slice(1, 4) : [spot.imageUrl, spot.imageUrl, spot.imageUrl]).map((img, idx) => (
                                              <img key={idx} src={img} className="w-16 h-12 rounded-lg object-cover border-2 border-white shadow-md" alt="" />
                                            ))}
                                        </div>
                                    </div>
                                    <div className="p-5 flex flex-col">
                                        <div className="flex items-start justify-between gap-3 mb-2">
                                            <div>
                                                <h3 className="font-bold text-[18px] leading-tight text-zinc-900">{spot.name}</h3>
                                                <p className="text-[12px] text-zinc-500 mt-0.5">{spot.location} • {spot.price}</p>
                                            </div>
                                            <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-amber-50 text-amber-600 text-[12px] font-semibold shrink-0">
                                                ★ {spot.rating}
                                            </div>
                                        </div>
                                        <div className="flex flex-wrap gap-1.5 my-3">
                                            <span className="px-2 py-1 rounded-md bg-green-50 text-green-700 border border-green-100 text-[11px] font-medium">✓ WiFi Tersedia</span>
                                            <span className="px-2 py-1 rounded-md bg-blue-50 text-blue-700 border border-blue-100 text-[11px] font-medium">{spot.openUntil}</span>
                                            <span className="px-2 py-1 rounded-md bg-purple-50 text-purple-700 border border-purple-100 text-[11px] font-medium">{spot.stats.crowd}</span>
                                        </div>
                                        <p className="text-[13px] text-zinc-500 leading-relaxed line-clamp-2">Lokasi yang cocok untuk nongkrong santai dengan vibe {spot.vibe}. Sangat direkomendasikan karena ratingnya {spot.rating}!</p>
                                        <div className="mt-auto pt-4 flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <div className="flex -space-x-1">
                                                    <img src="https://i.pravatar.cc/20?img=5" className="w-5 h-5 rounded-full border border-white" alt="" />
                                                    <img src="https://i.pravatar.cc/20?img=6" className="w-5 h-5 rounded-full border border-white" alt="" />
                                                    <img src="https://i.pravatar.cc/20?img=7" className="w-5 h-5 rounded-full border border-white" alt="" />
                                                </div>
                                                <span className="text-[11px] text-zinc-500">{spot.reviews} ulasan</span>
                                            </div>
                                            <button className="px-3.5 py-1.5 rounded-full bg-zinc-900 text-white text-[12px] font-medium hover:bg-black transition">Lihat Detail</button>
                                        </div>
                                    </div>
                                </div>
                              </>
                            ) : (
                              <>
                                <div className="relative h-[180px] overflow-hidden">
                                    <img src={spot.imageUrl} className="w-full h-full object-cover group-hover:scale-105 transition duration-700" alt="" />
                                    <div className="absolute top-2.5 left-2.5">
                                        <span className="px-2 py-1 rounded-full bg-white/90 backdrop-blur text-zinc-900 text-[10px] font-semibold shadow-sm">Vibe: {spot.stats.crowd}</span>
                                    </div>
                                    <button onClick={(e) => { e.stopPropagation(); }} className="absolute top-2.5 right-2.5 w-7 h-7 grid place-items-center rounded-full bg-white/90 backdrop-blur hover:bg-white transition text-zinc-700">
                                        <Bookmark size={14} />
                                    </button>
                                </div>
                                <div className="p-4">
                                    <div className="flex items-start justify-between gap-2 mb-1.5">
                                        <h3 className="font-semibold text-[15px] leading-snug text-zinc-900 line-clamp-1">{spot.name}</h3>
                                        <span className="text-[11px] font-medium text-amber-600 flex items-center gap-0.5 shrink-0">★ {spot.rating}</span>
                                    </div>
                                    <p className="text-[12px] text-zinc-500 line-clamp-1">{spot.location} • {spot.price}</p>
                                    <div className="flex items-center gap-1.5 mt-2.5">
                                        <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
                                        <span className="text-[11px] text-green-700 font-medium">{spot.openUntil}</span>
                                    </div>
                                    <div className="flex items-center justify-between mt-3 pt-3 border-t border-black/5">
                                        <div className="flex gap-1">
                                            <span className="px-1.5 py-0.5 rounded text-[10px] bg-zinc-100 text-zinc-600">WiFi</span>
                                            <span className="px-1.5 py-0.5 rounded text-[10px] bg-zinc-100 text-zinc-600">AC</span>
                                        </div>
                                        <span className="text-[11px] text-zinc-500">{spot.distance}</span>
                                    </div>
                                </div>
                              </>
                            )}
                        </article>
                      ))}
                    </motion.div>
                  ) : (
                    <motion.div key="map" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="bg-white rounded-[24px] border border-black/10 overflow-hidden h-[600px] relative">
                      <MapView spots={displaySpots} userLocation={userLocation} onSelectSpot={onSelectSpot} />
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Load More */}
                {viewMode === 'grid' && (
                  <div className="flex justify-center mt-8 mb-16">
                      <button className="px-6 py-2.5 rounded-full border border-black/15 hover:bg-black/5 text-[13px] font-medium flex items-center gap-2 text-zinc-700 transition">
                          Muat lebih banyak
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m6 9 6 6 6-6"/></svg>
                      </button>
                  </div>
                )}
            </div>
        </div>
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

  // Integrasi Database On-Demand
  useEffect(() => {
    if (userLocation && locationName && locationName !== 'Mencari Lokasi...' && locationName !== 'Akses Lokasi Tidak Tersedia') {
      console.log('Menjalankan Auto-Grow Database untuk:', locationName);
      fetchSpotsWithAutoGrow(locationName, userLocation.lat, userLocation.lng)
        .then(dbSpots => {
          if (dbSpots && dbSpots.length > 0) {
            setSpots(dbSpots);
          }
        })
        .catch(err => console.error('Gagal menarik data dari Supabase/AI:', err));
    }
  }, [userLocation, locationName]);

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
      // 1. (Dinonaktifkan agar tidak muncul error merah di console) Try Google Maps Geocoder
      /*
      if ((window as any).google && (window as any).google.maps && (window as any).google.maps.Geocoder) {
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
      */

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

    let lastLat: number | null = null;
    let lastLng: number | null = null;

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        
        // Cek jika perpindahan lebih dari ~50 meter (0.0005 derajat)
        if (lastLat === null || lastLng === null || Math.abs(lastLat - lat) > 0.0005 || Math.abs(lastLng - lng) > 0.0005) {
          lastLat = lat;
          lastLng = lng;
          setUserLocation({ lat, lng });
          resolveLocationName(lat, lng);
        }
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

      <div className="min-h-screen bg-transparent font-sans text-on-surface select-none relative">
        <div className="fixed inset-0 -z-10 noise">
          <div className="absolute inset-0 bg-gradient-to-b from-[#FFF7ED] via-[#FFFCF7] to-white"></div>
          <div className="absolute top-[-10%] right-[-10%] w-[500px] h-[500px] bg-[#FDBA74] rounded-full blob opacity-40"></div>
          <div className="absolute bottom-[-15%] left-[-10%] w-[600px] h-[600px] bg-[#FED7AA] rounded-full blob blob-2 opacity-50"></div>
          <div className="absolute top-[30%] left-[40%] w-[400px] h-[400px] bg-[#FCA5A5] rounded-full blob blob-3 opacity-30"></div>
          <div className="absolute inset-0 bg-[linear-gradient(to_right,#00000008_1px,transparent_1px),linear-gradient(to_bottom,#00000008_1px,transparent_1px)] bg-[size:48px_48px]"></div>
        </div>
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

        {currentPage !== 'detail' && <TopAppBar onNavigateToHome={() => setCurrentPage('radar')} onNavigateToAI={() => setCurrentPage('ai-finder')} onNavigateToSpots={() => setCurrentPage('spots')} />}

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
                <SpotsPage spots={spots} userLocation={userLocation} locationName={locationName} onSelectSpot={handleSelectSpot} />
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
