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
  (import.meta as any).env?.VITE_GOOGLE_MAPS_PLATFORM_KEY ||
  (globalThis as any).GOOGLE_MAPS_PLATFORM_KEY ||
  '';

const GEMINI_KEY =
  process.env.GEMINI_API_KEY ||
  (import.meta as any).env?.VITE_GEMINI_API_KEY ||
  '';

const hasValidKey = Boolean(MAP_KEY) && MAP_KEY !== 'YOUR_API_KEY';

const ai = new GoogleGenAI({ apiKey: GEMINI_KEY || 'MISSING_KEY' });

// --- Types ---
type Page = 'radar' | 'spots' | 'ai-finder' | 'detail';

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

// --- Components ---

const TopAppBar = () => (
  <header className="fixed top-4 left-1/2 -translate-x-1/2 z-[60] w-[calc(100%-2rem)] max-w-5xl rounded-2xl bg-surface/40 backdrop-blur-xl border border-on-surface/10 h-16 shadow-[0_20px_50px_rgba(0,0,0,0.3)]">
    <div className="flex justify-between items-center w-full px-6 h-full text-on-surface">
      <div className="flex items-center gap-3 group cursor-default">
        <motion.div 
          animate={{ rotate: [0, 90, 0] }}
          transition={{ repeat: Infinity, duration: 4 }}
          className="w-10 h-10 rounded-xl bg-cyan-400 flex items-center justify-center shadow-[0_0_20px_rgba(34,211,238,0.4)]"
        >
          <Radar size={20} className="text-black" />
        </motion.div>
        <div className="flex flex-col">
          <span className="heading-bold text-xl leading-none tracking-tighter">Vibe_OS</span>
          <span className="label-mono text-[7px] opacity-40">BETA_BUILD_2026 // BY_VIC</span>
        </div>
      </div>
      <div className="flex items-center gap-4">
        <div className="hidden sm:flex items-center gap-2 label-mono opacity-40 text-[8px]">
          <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
          SYSTEM_NOMINAL
        </div>
      </div>
    </div>
  </header>
);

const BottomNavBar = ({ activePage, setActivePage }: { activePage: Page, setActivePage: (p: Page) => void }) => {
  const tabs: { id: Page, icon: any, label: string }[] = [
    { id: 'radar' as const, icon: Radar, label: 'RADAR_SCAN' },
    { id: 'spots' as const, icon: Coffee, label: 'TITIK_LOKAL' },
    { id: 'ai-finder' as const, icon: Sparkles, label: 'PENCARI_AI' },
  ];

  return (
    <nav className="fixed bottom-6 left-1/2 -translate-x-1/2 w-[calc(100%-2rem)] max-w-xl z-[60] bg-on-surface text-surface flex justify-around items-center h-16 px-2 rounded-full shadow-[0_20px_50px_rgba(0,0,0,0.5)] border border-white/10">
      {tabs.map((tab) => {
        const isActive = activePage === tab.id;
        const Icon = tab.icon;
        
        return (
          <button
            key={tab.id}
            onClick={() => setActivePage(tab.id)}
            className={`relative flex items-center gap-2 transition-all duration-500 rounded-full px-4 sm:px-6 py-2.5 group overflow-hidden ${
              isActive 
                ? 'bg-surface text-on-surface scale-105' 
                : 'opacity-40 hover:opacity-100 hover:bg-surface/10'
            }`}
          >
            {isActive && (
              <motion.div 
                layoutId="nav-bg"
                className="absolute inset-0 bg-white"
                transition={{ type: 'spring', bounce: 0.2, duration: 0.6 }}
              />
            )}
            <div className="relative z-10 flex items-center gap-2">
              <Icon size={18} strokeWidth={isActive ? 3 : 2} className={isActive ? 'text-black' : 'text-white'} />
              <span className={`hidden sm:block label-mono text-[9px] font-black tracking-[0.1em] ${isActive ? 'text-black' : 'text-white'}`}>
                {tab.label}
              </span>
            </div>
            {isActive && (
              <div className="absolute -right-2 -top-2 w-6 h-6 bg-cyan-400 blur-xl opacity-50" />
            )}
          </button>
        );
      })}
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
        transform: 'translateZ(30px)'
      }}
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      className="absolute z-30 cursor-pointer group/ping preserve-3d"
    >
      <div className="relative">
        <div className="w-3 h-3 bg-cyan-400 rounded-full ping-active neon-glow-cyan" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 rounded-full border border-cyan-400/20 scale-0 group-hover/ping:scale-100 transition-transform duration-500" />
        
        {/* Hover Tip */}
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-4 p-3 bg-surface-bright border border-on-surface/20 opacity-0 group-hover/ping:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50 shadow-[0_10px_30px_rgba(0,0,0,0.5)] skew-x-[-6deg]">
          <span className="label-mono block text-[8px] opacity-40 mb-1">DATA_FOUND</span>
          <p className="heading-bold text-xs">{spot.name}</p>
          <div className="flex items-center gap-2 mt-1">
             <div className="w-1.5 h-1.5 bg-pink-500 rounded-full animate-pulse" />
             <span className="label-mono text-[7px] text-pink-500">{spot.stats.crowd.toUpperCase()}</span>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

const HomePage = ({ spots, userLocation, locationName, onSelectSpot }: { spots: Spot[], userLocation: {lat: number, lng: number} | null, locationName: string, onSelectSpot: (s: Spot) => void }) => {
  const [nearbyResults, setNearbyResults] = useState<Spot[]>([]);
  const [loadingNearby, setLoadingNearby] = useState(false);
  const placesLib = useMapsLibrary('places');

  useEffect(() => {
    if (!placesLib || !userLocation) return;
    
    const fetchNearby = async () => {
      setLoadingNearby(true);
      try {
        const cleanName = locationName.includes('...') ? '' : locationName.replace('.OS', '');
        const { places } = await placesLib.Place.searchByText({
          textQuery: `coffee shops cafes ${cleanName}`.trim(),
          locationBias: { center: userLocation, radius: 5000 },
          fields: ['id', 'displayName', 'location', 'formattedAddress', 'rating', 'userRatingCount', 'priceLevel', 'photos', 'reviews'],
          maxResultCount: 6,
        });

        const processed = places.map(p => {
          const photos = p.photos?.slice(0, 5).map(photo => photo.getURI({ maxWidth: 800 })) || [];
          return {
            id: p.id,
            name: p.displayName || 'UNKNOWN_NODE',
            location: p.formattedAddress?.split(',')[0] || 'COORD_LOST',
            rating: p.rating || 0,
            reviews: p.userRatingCount || 0,
            price: '$'.repeat(Number(p.priceLevel) || 1),
            openUntil: 'SYNC_REQUIRED',
            imageUrl: photos[0] || 'https://images.unsplash.com/photo-1501339817302-38203b9f9fef?auto=format&fit=crop&w=400&q=80',
            imageUrls: photos.length > 0 ? photos : ['https://images.unsplash.com/photo-1501339817302-38203b9f9fef?auto=format&fit=crop&w=400&q=80'],
            coordinates: { lat: p.location?.lat() || 0, lng: p.location?.lng() || 0 },
            stats: (() => {
              const { occupancy, label } = calculateOccupancy(p.rating || 0, p.userRatingCount || 0);
              return { crowd: label, occupancy, wifi: (200 + Math.floor(Math.random() * 300)) + ' Mbps' };
            })(),
            userReviews: [],
            googleReviews: (p as any).reviews?.map((r: any) => ({ text: r.text })) || []
          };
        }) as Spot[];

        setNearbyResults(processed);
      } catch (err) {
        console.error("NEARBY_FETCH_FAILED", err);
      } finally {
        setLoadingNearby(false);
      }
    };

    fetchNearby();
  }, [placesLib, userLocation, locationName]);

  // Generate semi-random but stable positions for spots on the radar
  const displaySpots = nearbyResults.length > 0 ? nearbyResults : spots;
  const radarSpots = displaySpots.slice(0, 5).map((spot, i) => {
    // Stable seed based on ID
    const seed = spot.id.charCodeAt(0) + (spot.id.charCodeAt(1) || 0);
    return {
      spot,
      angle: (seed * 137) % 360,
      radius: 15 + (seed % 30) // radius between 15% and 45%
    };
  });

  return (
    <motion.div 
      initial={{ opacity: 0 }} 
      animate={{ opacity: 1 }} 
      exit={{ opacity: 0 }}
      className="pt-24 pb-20 px-4 sm:px-8 max-w-4xl mx-auto overflow-hidden"
    >
      {/* 3D Radar Scanner Section */}
      <section className="relative perspective-1000 mb-16">
        <motion.div 
          animate={{ rotateX: [20, 25, 20], rotateY: [-5, 5, -5] }}
          transition={{ repeat: Infinity, duration: 8, ease: "easeInOut" }}
          className="relative aspect-square w-full max-w-[500px] mx-auto preserve-3d flex items-center justify-center bg-[radial-gradient(circle_at_center,_rgba(34,211,238,0.1)_0%,_transparent_70%)] rounded-full border border-on-surface/5"
        >
          <div className="absolute inset-0 border border-cyan-400/10 rounded-full"></div>
          <div className="absolute inset-[10%] border border-on-surface/10 rounded-full"></div>
          <div className="absolute inset-[30%] border border-on-surface/15 rounded-full"></div>
          <div className="absolute inset-[45%] border border-cyan-400/5 rounded-full border-dashed"></div>
          
          {/* Distance Indicators */}
          <div className="absolute top-1/2 left-[5%] -translate-y-1/2 label-mono opacity-40 text-[8px] text-cyan-400">2.5KM</div>
          <div className="absolute top-1/2 left-[20%] -translate-y-1/2 label-mono opacity-20 text-[8px]">1.2KM</div>
          <div className="absolute top-1/2 left-[35%] -translate-y-1/2 label-mono opacity-20 text-[8px]">0.5KM</div>

          <motion.div 
            animate={{ rotate: 360 }}
            transition={{ repeat: Infinity, duration: 6, ease: 'linear' }}
            className="absolute inset-0 radar-sweep opacity-20 z-10 origin-center"
          />

          {/* Floating Center Core */}
          <motion.div 
            animate={{ y: [-5, 5, -5] }}
            transition={{ repeat: Infinity, duration: 3, ease: "easeInOut" }}
            className="relative z-20 w-32 h-32 bg-cyan-400 text-surface flex flex-col items-center justify-center shadow-[0_0_50px_rgba(34,211,238,0.3)] skew-x-[-6deg] group hover:scale-110 transition-transform cursor-pointer"
          >
            <Radar size={40} strokeWidth={3} className="text-black group-hover:animate-pulse" />
            <span className="label-mono mt-2 font-black !tracking-[0.4em] text-black">OS_CORE</span>
          </motion.div>

          {/* Dynamic Pings */}
          {radarSpots.map(({ spot, angle, radius }) => (
            <div key={spot.id} onClick={() => onSelectSpot(spot)} className="preserve-3d" style={{ transform: 'translateZ(20px)' }}>
              <RadarPing spot={spot} angle={angle} radius={radius} />
            </div>
          ))}

          {/* Background Grid Lines */}
          <div className="absolute top-1/2 left-0 w-full h-[1px] bg-cyan-400/10" />
          <div className="absolute left-1/2 top-0 h-full w-[1px] bg-cyan-400/10" />
        </motion.div>

        {/* 3D Decorative Layers */}
        <div className="absolute -bottom-10 left-1/2 -translate-x-1/2 w-3/4 h-1/4 bg-cyan-400/5 blur-[100px] -z-10 rounded-full" />
      </section>

      {/* Bento Status Area */}
      <motion.div 
        whileHover={{ scale: 1.02, rotateX: 2, rotateY: -2 }}
        className="p-10 rounded-3xl border border-on-surface/10 mb-12 bg-surface-container shadow-[0_40px_100px_rgba(0,0,0,0.5)] relative overflow-hidden group perspective-1000"
      >
        <div className="absolute inset-0 bg-gradient-to-br from-cyan-400/5 to-pink-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
        <div className="absolute -right-10 -top-10 w-64 h-64 bg-cyan-400/10 blur-[100px] rounded-full group-hover:scale-150 transition-transform duration-1000" />
        
        <div className="relative z-10 flex flex-col sm:flex-row justify-between items-end sm:items-center gap-6">
          <div className="space-y-4">
            <span className="label-mono !text-cyan-400 flex items-center gap-3">
              <div className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-pulse shadow-[0_0_8px_cyan]" />
              SYST_LOCATOR: ACTIVE
            </span>
            <h2 className="text-5xl sm:text-7xl heading-bold text-transparent bg-clip-text bg-gradient-to-r from-on-surface to-on-surface/50 leading-none">{locationName}</h2>
          </div>
          <div className="flex flex-col items-end">
             <span className="label-mono opacity-20 text-[8px] mb-1">LAT_LNG_STREAM</span>
             <span className="label-mono text-[9px] font-black">{userLocation?.lat.toFixed(4) || '0.0000'} // {userLocation?.lng.toFixed(4) || '0.0000'}</span>
          </div>
        </div>
      </motion.div>

      {/* Enhanced Horizontal Spots */}
      <section className="mb-16">
        <div className="flex justify-between items-center mb-8 border-b border-on-surface/5 pb-4">
          <h2 className="text-xl heading-bold opacity-40">Titik_Terdekat_Hari_Ini</h2>
          <div className="flex gap-1">
            <div className="w-1.5 h-1.5 bg-cyan-400 rounded-full" />
            <div className="w-1.5 h-1.5 bg-pink-500 rounded-full" />
          </div>
        </div>
        <div className="flex gap-8 overflow-x-auto pb-12 scrollbar-hide snap-x perspective-1000">
          {loadingNearby ? (
             [1,2,3].map(i => (
               <div key={i} className="flex-shrink-0 w-80 h-96 bg-on-surface/5 animate-pulse rounded-2xl" />
             ))
          ) : (
            displaySpots.slice(0, 6).map((spot, idx) => (
              <motion.div 
                key={spot.id} 
                onClick={() => onSelectSpot(spot)}
                whileHover={{ y: -15, rotateY: 5, rotateX: 2 }}
                initial={{ opacity: 0, x: 50 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.1 }}
                className="flex-shrink-0 w-80 snap-center rounded-2xl overflow-hidden bg-surface-container-high border border-on-surface/10 hover:border-cyan-400/30 transition-all cursor-pointer group shadow-[0_10px_40px_rgba(0,0,0,0.5)]"
              >
                <div className="relative h-56 overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent z-10 opacity-60 group-hover:opacity-40 transition-opacity" />
                  <img src={spot.imageUrl} alt={spot.name} className="w-full h-full object-cover group-hover:scale-110 transition-all duration-700" />
                  <div className="absolute top-4 right-4 bg-cyan-400 text-black px-3 py-1 label-mono !font-black !text-[12px] z-20 neon-glow-cyan">
                    {spot.rating}★
                  </div>
                  <div className="absolute bottom-4 left-4 z-20">
                     <span className="label-mono !text-surface !text-[10px] bg-on-surface/20 backdrop-blur-md px-2 py-1">{spot.price}</span>
                  </div>
                </div>
                <div className="p-8 space-y-6">
                  <div>
                    <h3 className="text-2xl heading-bold mb-1 group-hover:text-cyan-400 transition-colors uppercase truncate">{spot.name}</h3>
                    <p className="label-mono opacity-40 text-[10px]">{spot.location}</p>
                  </div>
                  
                  <div className="flex items-center justify-between pt-4 border-t border-on-surface/5">
                    <div className="flex flex-col gap-1">
                      <span className="label-mono text-[8px] opacity-40">CROWD_LVL</span>
                      <span className="text-xs font-bold uppercase tracking-widest text-pink-500">{spot.stats.crowd}</span>
                    </div>
                    <ArrowRight size={20} className="opacity-0 group-hover:opacity-100 group-hover:translate-x-2 transition-all text-cyan-400" />
                  </div>
                </div>
              </motion.div>
            ))
          )}
        </div>
      </section>

      {/* Neon AI CTA */}
      <motion.section 
        whileHover={{ scale: 0.98 }}
        className="p-12 rounded-3xl border-2 border-cyan-400/30 bg-on-surface text-surface relative overflow-hidden group cursor-pointer shadow-[0_0_80px_rgba(34,211,238,0.2)]"
      >
        <div className="absolute -right-20 -top-20 w-80 h-80 bg-cyan-400/20 rounded-full blur-[100px] group-hover:scale-125 transition-transform duration-1000" />
        <div className="absolute -left-20 -bottom-20 w-80 h-80 bg-pink-500/10 rounded-full blur-[100px]" />
        
        <div className="relative z-10 flex flex-col sm:flex-row items-center justify-between gap-8">
          <div className="space-y-6 text-center sm:text-left">
            <span className="label-mono !text-black bg-cyan-400 px-3 py-1 font-black">AI_CORE_ACTIVE</span>
            <div className="space-y-2">
              <h3 className="text-4xl heading-bold tracking-tight">Kopi Favoritmu Menunggu.</h3>
              <p className="text-lg font-medium italic opacity-60 max-w-sm">\"Mesin kami siap memindai kafe terbaik yang sesuai dengan vibe-mu saat ini.\"</p>
            </div>
          </div>
          
          <button className="flex items-center gap-4 px-8 py-5 bg-surface text-on-surface rounded-full font-black uppercase tracking-[0.2em] text-xs hover:bg-cyan-400 hover:text-black transition-all group-hover:shadow-[0_0_30px_rgba(34,211,238,0.5)]">
            Akses_Pencari <ArrowRight size={22} className="group-hover:translate-x-2 transition-transform" />
          </button>
        </div>
      </motion.section>
    </motion.div>
  );
};

const AIFinderPage = ({ spots, userLocation, locationName, onSelectSpot }: { spots: Spot[], userLocation: {lat: number, lng: number} | null, locationName: string, onSelectSpot: (s: Spot) => void }) => {
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
          name: p.displayName || 'Unknown Node',
          location: p.formattedAddress?.split(',')[0] || 'Unknown Sector',
          distance: 'SECURED_LINK',
          vibe: p.priceLevel ? '$'.repeat(Number(p.priceLevel)) : 'NEURAL_VIBE',
          rating: p.rating || 0,
          reviews: p.userRatingCount || 0,
          price: p.priceLevel ? '$'.repeat(Number(p.priceLevel)) : '$$',
          openUntil: 'PROTOCOL_VARY',
          imageUrl: photos[0] || 'https://images.unsplash.com/photo-1501339817302-38203b9f9fef?auto=format&fit=crop&w=800&q=80',
          imageUrls: photos.length > 0 ? photos : ['https://images.unsplash.com/photo-1501339817302-38203b9f9fef?auto=format&fit=crop&w=800&q=80'],
          coordinates: { lat: p.location?.lat() || 0, lng: p.location?.lng() || 0 },
          stats: (() => {
            const { occupancy, label } = calculateOccupancy(p.rating || 0, p.userRatingCount || 0);
            return { crowd: label, occupancy, wifi: (100 + Math.floor(Math.random() * 400)) + ' Mbps' };
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

  const chips = ["KERJA_HENING", "SANGRAIAN_GELAP", "VIBE_ESTETIK", "KOPI_MURAH"];
  return (
    <motion.div 
      initial={{ opacity: 0 }} 
      animate={{ opacity: 1 }}
      className="pt-28 pb-32 px-4 sm:px-8 max-w-4xl mx-auto space-y-16"
    >
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-pulse shadow-[0_0_10px_rgba(34,211,238,0.8)]" />
          <span className="label-mono text-[9px] text-cyan-400 tracking-[0.3em]">{searching ? 'PEMINDAIAN_BERJALAN' : 'MESIN_SINTESIS_AKTIF'}</span>
        </div>
        <h2 className="text-6xl sm:text-[100px] leading-[0.75] heading-bold uppercase">Apa Mood<br/><span className="text-transparent bg-clip-text bg-gradient-to-r from-on-surface to-on-surface/20 italic">Hari_Ini?</span></h2>
      </div>

      <div className="relative group">
        <div className="absolute -inset-1 bg-gradient-to-r from-cyan-400/20 via-pink-500/20 to-cyan-400/20 rounded-3xl blur-xl opacity-50 group-hover:opacity-100 transition duration-1000 group-hover:duration-200" />
        <div className="relative flex flex-col sm:flex-row items-stretch bg-surface-container-high rounded-3xl overflow-hidden border border-white/5 shadow-2xl">
          <div className="flex-1 flex items-center px-8 border-b sm:border-b-0 sm:border-r border-white/5">
             <Sparkles size={20} className="text-cyan-400 mr-4 flex-shrink-0" />
             <input 
               className="w-full bg-transparent border-none focus:outline-none text-lg font-bold py-8 placeholder:text-on-surface/20 uppercase appearance-none" 
               placeholder="IDENTIFIKASI_MOOD_ANDA..." 
               value={query}
               onChange={(e) => setQuery(e.target.value)}
               onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
             />
          </div>
          <button 
            onClick={handleSearch}
            disabled={searching}
            className="bg-cyan-400 text-black px-12 py-6 font-black uppercase text-xs tracking-[0.2em] hover:bg-white active:scale-95 transition-all disabled:opacity-50"
          >
            {searching ? 'DIGESTING' : 'PINDAI'}
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        {chips.map(c => (
          <motion.button 
            key={c} 
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => {setQuery(c.replace('_', ' ')); handleSearch();}}
            className="px-6 py-3 rounded-full bg-surface-container-high border border-on-surface/5 label-mono text-[9px] hover:border-pink-500/50 hover:text-pink-500 transition-all flex items-center gap-2"
          >
            <div className={`w-1 h-1 rounded-full ${query === c.replace('_', ' ') ? 'bg-pink-500' : 'bg-on-surface/20'}`} />
            {c}
          </motion.button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-10">
        {(results.length > 0 ? results : spots.slice(1, 3)).map((spot, idx) => (
          <motion.div 
            key={spot.id} 
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.1 }}
            onClick={() => onSelectSpot(spot)}
            className="group relative bg-surface-container rounded-3xl overflow-hidden border border-on-surface/5 hover:border-cyan-400/30 transition-all cursor-pointer shadow-xl hover:shadow-[0_40px_80px_rgba(0,0,0,0.6)]"
          >
            <div className="flex flex-col md:flex-row gap-8 p-10">
              <div className="w-full md:w-80 aspect-[16/10] sm:aspect-auto sm:h-56 relative rounded-2xl overflow-hidden flex-shrink-0">
                <img src={spot.imageUrl} alt={spot.name} className="w-full h-full object-cover grayscale brightness-75 group-hover:grayscale-0 group-hover:brightness-100 group-hover:scale-105 transition-all duration-700" />
                <div className="absolute top-4 left-4 bg-on-surface/40 backdrop-blur-md text-surface px-4 py-1.5 label-mono !text-[10px] !font-black skew-x-[-12deg]">
                  {spot.vibe}
                </div>
              </div>
              <div className="flex-1 flex flex-col justify-between py-2">
                <div className="space-y-4">
                  <div className="flex justify-between items-start">
                    <h3 className="text-4xl heading-bold uppercase leading-[0.8] tracking-tighter group-hover:text-cyan-400 transition-colors">{spot.name}</h3>
                    <div className="text-3xl font-black italic text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-pink-500">#{spot.rating}</div>
                  </div>
                  <p className="text-sm label-mono opacity-40 uppercase tracking-widest">{spot.location} // CLS_FREQ: {spot.reviews}</p>
                </div>
                
                <div className="flex items-center gap-8 pt-8 border-t border-on-surface/5">
                   <div className="space-y-1">
                      <span className="label-mono text-[8px] opacity-20">INFRA_STATUS</span>
                      <div className="flex items-center gap-2">
                         <Wifi size={14} className="text-cyan-400" />
                         <span className="label-mono text-[9px]">ULTRA_NET</span>
                      </div>
                   </div>
                   <div className="space-y-1">
                      <span className="label-mono text-[8px] opacity-20">CROWD_LVL</span>
                      <div className="flex items-center gap-2">
                         <div className="w-2 h-2 rounded-full bg-pink-500 animate-pulse" />
                         <span className="label-mono text-[9px] text-pink-500">{spot.stats.crowd}</span>
                      </div>
                   </div>
                   <ArrowRight size={24} className="ml-auto opacity-0 group-hover:opacity-100 group-hover:translate-x-2 transition-all text-cyan-400" />
                </div>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
};

const ReviewSection = ({ spot, onAddReview }: { spot: Spot, onAddReview: (r: Review) => void }) => {
  const [comment, setComment] = useState('');
  const [rating, setRating] = useState(5);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!comment.trim()) return;

    setSubmitting(true);
    const sentiment = await analyzeSentiment(comment);
    
    const newReview: Review = {
      id: Math.random().toString(36).substr(2, 9),
      user: 'USR_' + Math.random().toString(36).substr(2, 4).toUpperCase(),
      rating,
      comment,
      sentiment,
      date: new Date().toISOString().split('T')[0]
    };

    onAddReview(newReview);
    setComment('');
    setRating(5);
    setSubmitting(false);
  };

  return (
    <section className="space-y-16 pt-16 border-t border-on-surface/5">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-6">
        <div>
          <span className="label-mono !text-cyan-400 block mb-2">TELEMETRI_UMPAN_BALIK</span>
          <h3 className="text-5xl heading-bold uppercase">Log_Protokol</h3>
        </div>
        <div className="flex items-center gap-4 bg-surface-container px-6 py-3 rounded-full border border-on-surface/5">
           <div className="flex gap-1">
             {[1,2,3,4,5].map(i => <Star key={i} size={14} className={i <= Math.round(spot.rating) ? 'text-yellow-400 fill-yellow-400' : 'text-on-surface/10'} />)}
           </div>
           <span className="text-2xl font-black italic">{spot.rating}</span>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="relative group">
        <div className="absolute -inset-1 bg-gradient-to-r from-cyan-400/20 to-pink-500/20 rounded-3xl blur-md opacity-20 group-hover:opacity-40 transition-all" />
        <div className="relative space-y-12 bg-surface-container rounded-3xl p-8 sm:p-12 border border-on-surface/5 shadow-2xl">
          <div className="space-y-6">
            <span className="label-mono opacity-40 flex items-center gap-3">
               <div className="w-1.5 h-1.5 bg-yellow-400 rounded-full" />
               INDEX_KEPUASAN_USER
            </span>
            <div className="flex gap-4">
              {[1, 2, 3, 4, 5].map(s => (
                <button 
                  key={s} 
                  type="button"
                  onClick={() => setRating(s)}
                  className={`w-14 h-14 flex items-center justify-center rounded-2xl border transition-all duration-300 ${
                    rating === s ? 'bg-cyan-400 border-cyan-400 text-black shadow-[0_0_20px_rgba(34,211,238,0.5)]' : 'border-on-surface/10 hover:bg-on-surface/5'
                  }`}
                >
                  <span className="text-xl font-black">{s}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-6">
            <span className="label-mono opacity-40 flex items-center gap-3">
               <div className="w-1.5 h-1.5 bg-pink-500 rounded-full" />
               KOMENTAR_DI_GRID
            </span>
            <div className="relative">
              <textarea 
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="DEFINISIKAN_PENGALAMAN_ANDA_DI_SINI..."
                className="w-full bg-surface/50 border border-on-surface/10 rounded-2xl p-8 min-h-[160px] focus:outline-none focus:border-cyan-400 transition-all text-xl font-medium tracking-tight placeholder:italic placeholder:opacity-20"
              />
              <div className="absolute bottom-6 right-6 label-mono opacity-10 pointer-events-none">CHAR_SYNC: {comment.length}</div>
            </div>
          </div>

          <button 
            disabled={submitting}
            className="w-full py-6 rounded-2xl bg-on-surface text-surface label-mono !font-black !text-[14px] tracking-[0.5em] hover:bg-cyan-400 hover:text-black hover:shadow-[0_0_40px_rgba(34,211,238,0.3)] active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-4"
          >
            {submitting ? 'SINKRONISASI_AI...' : <><Send size={18} /> UNGGAH_KE_GRID</>}
          </button>
        </div>
      </form>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
        {spot.userReviews.map((review, idx) => (
          <motion.div 
            key={review.id} 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.1 }}
            className="p-8 rounded-3xl border border-on-surface/5 hover:border-cyan-400/30 transition-all bg-surface-container-low group relative overflow-hidden"
          >
            <div className="absolute -right-4 -top-4 w-12 h-12 bg-on-surface/5 rounded-full blur-xl group-hover:bg-cyan-400/10 transition-all" />
            <div className="flex justify-between items-start mb-8">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                   <div className="w-2 h-2 bg-on-surface opacity-20 rounded-full" />
                   <span className="label-mono !text-[11px] font-black">{review.user}</span>
                </div>
                <p className="label-mono opacity-20 !text-[8px] ml-4">{review.date}</p>
              </div>
              <div className={`px-4 py-1 label-mono !text-[9px] font-black rounded-full border ${
                review.sentiment === 'POSITIVE' ? 'border-cyan-400 text-cyan-400 shadow-[0_0_10px_rgba(34,211,238,0.2)]' : 
                review.sentiment === 'NEGATIVE' ? 'border-pink-500 text-pink-500' : 'border-on-surface/20 opacity-40'
              }`}>
                {review.sentiment}
              </div>
            </div>
            
            <p className="text-xl font-medium tracking-tight opacity-70 leading-relaxed mb-8 italic">
              "{review.comment}"
            </p>

            <div className="flex gap-1 pt-6 border-t border-on-surface/5">
              {[...Array(5)].map((_, i) => (
                <div key={i} className={`h-1 flex-1 rounded-full ${i < review.rating ? 'bg-cyan-400' : 'bg-on-surface/10'}`} />
              ))}
            </div>
          </motion.div>
        ))}
      </div>
    </section>
  );
};

const RouteView = ({ from, to }: { from: {lat: number, lng: number}, to: {lat: number, lng: number} }) => {
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
        }
      }
    );
  }, [directionsRenderer, from, to]);

  return null;
};

const DetailPage = ({ spot, userLocation, onUpdateSpot, onBack, onShare }: { spot: Spot, userLocation: {lat: number, lng: number} | null, onUpdateSpot: (s: Spot) => void, onBack: () => void, onShare: () => void }) => {
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);
  const [extractedMenu, setExtractedMenu] = useState<{name: string, price: number}[]>([]);
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
        const prompt = `Following are Google Maps reviews for a cafe named "${spot.name}" in "${spot.location}". 
        Extract 4-5 typical menu items and their prices in IDR (Rupiah) mentioned in these reviews. 
        If specific prices are NOT mentioned, estimate them based on the cafe's price level (${spot.price}) where $ is cheap (15k-30k), $$ is mid (30k-60k), and $$$ is premium (60k+).
        Return ONLY a JSON array of objects with "name" and "price" (number) keys.
        
        Reviews:
        ${reviewText.substring(0, 3000)}`;

        const response = await ai.models.generateContent({
          model: "gemini-1.5-flash",
          contents: prompt
        });

        const text = response.text.replace(/```json|```/g, '').trim();
        const parsed = JSON.parse(text);
        if (Array.isArray(parsed)) {
          setExtractedMenu(parsed.slice(0, 6));
        }
      } catch (err) {
        console.error("MENU_EXTRACTION_FAILED", err);
        setExtractedMenu([]); // Ensure fallback triggers
      } finally {
        setLoadingMenu(false);
      }
    };

    fetchExtractedMenu();
  }, [spot.id]);

  const handleAddReview = (newReview: Review) => {
    const updatedReviews = [newReview, ...spot.userReviews];
    const newRating = Number(((spot.rating * spot.reviews + newReview.rating) / (spot.reviews + 1)).toFixed(1));
    
    onUpdateSpot({
      ...spot,
      userReviews: updatedReviews,
      rating: newRating,
      reviews: spot.reviews + 1
    });
  };

  const nextPhoto = useCallback(() => {
    setCurrentPhotoIndex((prev) => (prev + 1) % spot.imageUrls.length);
  }, [spot.imageUrls.length]);

  const prevPhoto = useCallback(() => {
    setCurrentPhotoIndex((prev) => (prev - 1 + spot.imageUrls.length) % spot.imageUrls.length);
  }, [spot.imageUrls.length]);

  useEffect(() => {
    if (spot.imageUrls.length <= 1) return;
    const interval = setInterval(nextPhoto, 5000); // Auto-advance every 5 seconds
    return () => clearInterval(interval);
  }, [nextPhoto]);

  // Use extracted menu if available, otherwise fallback to base simulation
  const basePrice = spot.price.length * 15000 + 10000;
  const menu = extractedMenu.length > 0 ? extractedMenu : [
    { name: 'Kopi Susu Lokal', price: basePrice },
    { name: 'Black Coffee OS', price: basePrice - 5000 },
    { name: 'Manual Brew V60', price: basePrice + 10000 },
    { name: 'Latte Art Node', price: basePrice + 5000 },
  ];

  return (
    <motion.div 
      initial={{ opacity: 0, x: 50 }} 
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -50 }}
      className="bg-surface min-h-screen pb-20 overflow-x-hidden"
    >
      <header className="sticky top-0 z-50 bg-surface/80 backdrop-blur-xl border-b border-on-surface/10 px-8 h-16 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="text-on-surface hover:opacity-60 transition-opacity">
            <ChevronLeft size={24} />
          </button>
          <span className="label-mono opacity-40 uppercase">Detail_Protokol</span>
        </div>
        <div className="flex items-center gap-6">
          <button onClick={onShare} className="text-on-surface hover:bg-on-surface/5 p-2 transition-colors"><Share2 size={20} /></button>
          <button className="text-on-surface hover:bg-on-surface/5 p-2 transition-colors"><Bookmark size={20} /></button>
        </div>
      </header>

      <main className="p-4 sm:p-12 max-w-6xl mx-auto flex flex-col lg:flex-row gap-16">
        <section className="flex-1 space-y-16">
          {/* 3D Photo Slider */}
          <div className="perspective-1000">
            <motion.div 
              whileHover={{ rotateY: 5, rotateX: 2 }}
              className="relative aspect-[16/9] group overflow-hidden rounded-3xl border border-on-surface/10 bg-surface-container shadow-[0_50px_100px_rgba(0,0,0,0.4)] preserve-3d"
            >
              <AnimatePresence mode="wait">
                <motion.img 
                  key={currentPhotoIndex}
                  src={spot.imageUrls[currentPhotoIndex]} 
                  alt={`${spot.name} - ${currentPhotoIndex + 1}`} 
                  initial={{ opacity: 0, scale: 1.2, rotate: 2 }}
                  animate={{ opacity: 1, scale: 1, rotate: 0 }}
                  exit={{ opacity: 0, scale: 0.8, rotate: -2 }}
                  transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                  className="w-full h-full object-cover grayscale brightness-90 transition-all duration-700 group-hover:grayscale-0 group-hover:brightness-100"
                />
              </AnimatePresence>
              
              <div className="absolute top-6 right-6 bg-cyan-400 text-black px-6 py-2 label-mono !font-black !text-[14px] z-10 neon-glow-cyan">
                PIC_{String(currentPhotoIndex + 1).padStart(2, '0')}
              </div>

              {spot.imageUrls.length > 1 && (
                <>
                  <button 
                    onClick={prevPhoto}
                    className="absolute left-6 top-1/2 -translate-y-1/2 w-14 h-14 bg-surface/20 backdrop-blur-xl text-on-surface rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all hover:bg-cyan-400 hover:text-black shadow-2xl border border-on-surface/10"
                  >
                    <ChevronLeft size={28} />
                  </button>
                  <button 
                    onClick={nextPhoto}
                    className="absolute right-6 top-1/2 -translate-y-1/2 w-14 h-14 bg-surface/20 backdrop-blur-xl text-on-surface rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all hover:bg-cyan-400 hover:text-black shadow-2xl border border-on-surface/10"
                  >
                    <ArrowRight size={28} />
                  </button>
                </>
              )}

              <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex gap-3 z-10">
                {spot.imageUrls.map((_, i) => (
                  <button 
                    key={i} 
                    onClick={() => setCurrentPhotoIndex(i)}
                    className={`h-1.5 transition-all duration-500 rounded-full ${i === currentPhotoIndex ? 'bg-cyan-400 w-12 shadow-[0_0_10px_rgba(34,211,238,0.8)]' : 'bg-white/30 w-3 hover:bg-white/50'}`} 
                  />
                ))}
              </div>
            </motion.div>
          </div>

          <div className="space-y-8">
            <div className="flex items-center gap-4">
              <span className="label-mono !text-cyan-400 bg-cyan-400/10 px-3 py-1 rounded-sm">IDENTIFIED_LOCATION</span>
              <div className="h-[1px] flex-1 bg-on-surface/5" />
            </div>
            <h2 className="text-5xl sm:text-8xl heading-bold tracking-tight uppercase leading-[0.8]">{spot.name}</h2>
            
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-8 pt-8">
               <div className="space-y-2">
                 <span className="label-mono opacity-40">System_Rating</span>
                 <p className="text-5xl font-black italic text-cyan-400">{spot.rating}<span className="text-xl opacity-20">/5.0</span></p>
               </div>
               <div className="space-y-2">
                 <span className="label-mono opacity-40">Cost_Scale</span>
                 <p className="text-5xl font-black italic">{spot.price}</p>
               </div>
               <div className="space-y-2 col-span-2">
                 <span className="label-mono opacity-40">Operation_Window</span>
                 <p className="text-2xl font-bold uppercase tracking-wider">SAMPAI_{spot.openUntil}</p>
                 <div className="flex gap-1">
                   {[1,2,3,4,5,6,7].map(i => <div key={i} className={`h-1 flex-1 ${i < 6 ? 'bg-cyan-400/40' : 'bg-on-surface/5'}`} />)}
                 </div>
               </div>
            </div>
          </div>

          {/* Futuristic Menu Section */}
          <div className="relative p-1 rounded-3xl overflow-hidden bg-gradient-to-br from-cyan-400/20 to-pink-500/20 border border-on-surface/5">
            <div className="bg-surface p-8 sm:p-12 rounded-[inherit] space-y-12">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
                <div>
                  <h3 className="text-3xl heading-bold mb-2">REKAPITULASI_MENU</h3>
                  <p className="label-mono opacity-40 flex items-center gap-2">
                    <Zap size={14} className="text-cyan-400" />
                    STATUS: {loadingMenu ? 'DIGESTING_DATA...' : 'ANALYSIS_COMPLETE'}
                  </p>
                </div>
                <div className="bg-on-surface text-surface px-6 py-3 label-mono !font-black skew-x-[-12deg] neon-glow-cyan">
                  {spot.price} COST_INDEX
                </div>
              </div>
              
              {loadingMenu ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                  {[1,2,3,4].map(i => (
                    <div key={i} className="h-16 bg-on-surface/5 w-full rounded-xl animate-pulse" />
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-16 gap-y-8">
                  {menu.map((item) => (
                    <motion.div 
                      key={item.name} 
                      whileHover={{ x: 10 }}
                      className="flex justify-between items-center group cursor-pointer border-b border-on-surface/5 pb-4"
                    >
                      <div className="space-y-1">
                        <span className="text-xl font-bold uppercase group-hover:text-cyan-400 transition-colors">{item.name}</span>
                        <div className="w-12 h-[2px] bg-cyan-400 scale-x-0 group-hover:scale-x-100 transition-transform origin-left" />
                      </div>
                      <span className="text-2xl font-black italic text-transparent bg-clip-text bg-gradient-to-r from-on-surface to-on-surface/40">
                        {item.price.toLocaleString('id-ID')}
                      </span>
                    </motion.div>
                  ))}
                </div>
              )}
              
              <div className="pt-8 border-t border-on-surface/5 flex flex-col sm:flex-row justify-between items-center gap-4">
                 <p className="text-[10px] label-mono opacity-20 italic max-w-sm">
                   {extractedMenu.length > 0 ? '*HASIL_SINTESIS_AI: Data diolah dari ulasan publik Google Maps.' : '*DATA_SIMULASI: Estimasi biaya berdasarkan profil tempat.'}
                 </p>
                 <button className="text-cyan-400 label-mono hover:bg-cyan-400/10 px-4 py-2 transition-all">LIHAT_KARTU_MENU_LENGKAP</button>
              </div>
            </div>
          </div>
        </section>


        <section className="w-full md:w-1/3 space-y-12">
          <div className="space-y-6">
            <span className="label-mono opacity-40">Data_Lingkungan_Langsung</span>
            <div className="grid grid-cols-1 gap-4">
              <div className="p-8 border-2 border-on-surface bg-on-surface text-surface group relative overflow-hidden">
                 <div className="absolute -right-4 -top-4 w-20 h-20 bg-surface/5 rounded-full blur-2xl" />
                 <span className="label-mono !text-surface/40 block mb-6">TINGKAT_KETERISIAN</span>
                 <div className="flex items-end gap-3 translate-x-[-4px]">
                    <span className="text-6xl font-black heading-bold">{spot.stats.occupancy}%</span>
                    <span className="label-mono !text-surface/60 pb-2">KONDISI_{spot.stats.crowd.toUpperCase()}</span>
                 </div>
              </div>
              <div className="p-8 border border-on-surface/10 bg-surface-container">
                 <span className="label-mono opacity-40 block mb-6">KECEPATAN_INTERNET</span>
                 <div className="flex items-end gap-3">
                    <span className="text-4xl font-black italic tracking-tighter">{spot.stats.wifi}</span>
                    <span className="label-mono opacity-40 pb-1">SINKRONISASI_AKTIF</span>
                 </div>
              </div>
            </div>
          </div>

          <div className="space-y-6">
             <span className="label-mono opacity-40">Posisi_Geo & Rute</span>
             <div className="aspect-square bg-surface-container border border-on-surface/10 relative overflow-hidden">
               {hasValidKey ? (
                 <Map
                   defaultCenter={spot.coordinates}
                   defaultZoom={14}
                   mapId="DETAIL_MAP_ID"
                   disableDefaultUI={true}
                   gestureHandling={'greedy'}
                   style={{ width: '100%', height: '100%' }}
                 >
                   <AdvancedMarker position={spot.coordinates} />
                   {userLocation && <RouteView from={userLocation} to={spot.coordinates} />}
                 </Map>
               ) : (
                 <div className="w-full h-full flex items-center justify-center label-mono opacity-20 text-[10px]">
                   MAP_SYNC_REQUIRED
                 </div>
               )}
             </div>
             <p className="text-sm font-medium italic opacity-60 leading-snug">\"Menghitung rute optimal dari posisi Anda ke titik {spot.name}.\"</p>
          </div>
        </section>
      </main>

      <div className="fixed bottom-12 left-1/2 -translate-x-1/2 w-full px-12 z-[60] max-w-5xl">
         <button className="w-full h-20 bg-on-surface text-surface heading-bold text-lg tracking-[0.4em] flex items-center justify-center gap-4 hover:opacity-90 active:translate-y-1 transition-all">
           MULAI_NAVIGASI <ArrowRight size={24} />
         </button>
      </div>

      <ReviewSection spot={spot} onAddReview={handleAddReview} />
    </motion.div>
  );
};

const MapView = ({ spots, userLocation, onSelectSpot }: { spots: Spot[], userLocation: {lat: number, lng: number} | null, onSelectSpot: (s: Spot) => void }) => {
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

const SpotsPage = ({ spots, userLocation, onSelectSpot }: { spots: Spot[], userLocation: {lat: number, lng: number} | null, onSelectSpot: (s: Spot) => void }) => {
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list');
  const [recommendations, setRecommendations] = useState<Spot[]>([]);
  const placesLib = useMapsLibrary('places');

  useEffect(() => {
    const getRecommendations = async () => {
      if (!placesLib || !userLocation) {
        // Fallback to existing spots if no user location
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
            name: p.displayName || 'Unknown Node',
            location: p.formattedAddress?.split(',')[0] || 'Unknown Sector',
            distance: 'REC_SYNC',
            rating: p.rating || 0,
            reviews: p.userRatingCount || 0,
            price: p.priceLevel ? '$'.repeat(Number(p.priceLevel)) : '$$',
            openUntil: 'PROTOCOL_VARY',
            imageUrl: photos[0] || 'https://images.unsplash.com/photo-1501339817302-38203b9f9fef?auto=format&fit=crop&w=400&q=80',
            imageUrls: photos.length > 0 ? photos : ['https://images.unsplash.com/photo-1501339817302-38203b9f9fef?auto=format&fit=crop&w=400&q=80'],
            coordinates: { lat: p.location?.lat() || 0, lng: p.location?.lng() || 0 },
            stats: (() => {
              const { occupancy, label } = calculateOccupancy(p.rating || 0, p.userRatingCount || 0);
              return { crowd: label, occupancy, wifi: 'SYNC_STABLE' };
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
      className="pt-24 px-4 sm:px-8 pb-32 max-w-6xl mx-auto space-y-16"
    >
      <div className="flex flex-col sm:flex-row justify-between items-end gap-6 border-b border-on-surface/5 pb-12">
        <div className="space-y-4">
          <div className="flex items-center gap-3">
             <div className="w-2 h-2 bg-cyan-400 rounded-full neon-glow-cyan animate-pulse" />
             <span className="label-mono opacity-40">System_Interface_0.4</span>
          </div>
          <h2 className="text-6xl sm:text-8xl heading-bold tracking-tighter uppercase leading-[0.8]">Titik_Lokal</h2>
        </div>
        
        <div className="flex p-1 bg-surface-container rounded-full border border-on-surface/10 perspective-1000">
          <button 
            onClick={() => setViewMode('list')}
            className={`px-8 py-3 rounded-full flex items-center gap-2 transition-all duration-500 ${viewMode === 'list' ? 'bg-on-surface text-surface shadow-[0_10px_20px_rgba(0,0,0,0.4)]' : 'opacity-40 hover:opacity-100'}`}
          >
            <List size={16} />
            <span className="label-mono !text-[10px] font-black">LIST_VIEW</span>
          </button>
          <button 
            onClick={() => setViewMode('map')}
            className={`px-8 py-3 rounded-full flex items-center gap-2 transition-all duration-500 ${viewMode === 'map' ? 'bg-on-surface text-surface shadow-[0_10px_20px_rgba(0,0,0,0.4)]' : 'opacity-40 hover:opacity-100'}`}
          >
            <MapIcon size={16} />
            <span className="label-mono !text-[10px] font-black">MAP_OS</span>
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
            className="space-y-20"
          >
            {/* Recommendations Sub-section */}
            <section>
              <div className="flex items-center justify-between mb-8">
                <span className="label-mono !text-pink-500">REKOMENDASI_UNTUK_ANDA</span>
                <span className="label-mono opacity-20 text-[8px]">NEARBY_SCAN: ACTIVE</span>
              </div>
              <div className="flex gap-8 overflow-x-auto pb-10 scrollbar-hide snap-x perspective-1000">
                {recommendations.map((s, idx) => (
                  <motion.div
                    key={`rec-${s.id}`}
                    whileHover={{ scale: 1.05, rotateY: 5, y: -10 }}
                    onClick={() => onSelectSpot(s)}
                    className="flex-shrink-0 w-72 snap-center rounded-3xl overflow-hidden bg-surface-container border border-on-surface/10 hover:border-cyan-400 group cursor-pointer transition-all shadow-[0_20px_50px_rgba(0,0,0,0.3)]"
                  >
                    <div className="relative aspect-[16/10]">
                       <img src={s.imageUrl} className="w-full h-full object-cover grayscale brightness-75 group-hover:grayscale-0 group-hover:brightness-100 transition-all duration-700" />
                       <div className="absolute top-4 right-4 bg-cyan-400 text-black px-3 py-1 label-mono !font-black !text-[10px] neon-glow-cyan">#{s.rating}</div>
                    </div>
                    <div className="p-6 space-y-4">
                       <h3 className="text-xl heading-bold uppercase truncate">{s.name}</h3>
                       <div className="flex justify-between items-center text-[8px] label-mono opacity-40">
                          <span>{s.location}</span>
                          <span className="text-pink-500">{s.price}</span>
                       </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </section>

            {/* List Header */}
            <div className="flex items-center gap-4">
              <span className="label-mono opacity-40">DATABASE_PENGGUNA // LENGKAP</span>
              <div className="h-[1px] flex-1 bg-on-surface/5" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
              {spots.map((s, idx) => (
                <motion.div 
                  key={s.id} 
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: idx * 0.05 }}
                  onClick={() => onSelectSpot(s)} 
                  className="group relative bg-surface-container rounded-3xl p-8 flex gap-8 cursor-pointer hover:border-cyan-400/50 border border-on-surface/5 transition-all shadow-xl hover:shadow-[0_30px_60px_rgba(0,0,0,0.5)] overflow-hidden"
                >
                  <div className="absolute -right-32 -bottom-32 w-64 h-64 bg-cyan-400/5 rounded-full blur-[80px] group-hover:bg-cyan-400/10 transition-all" />
                  <div className="w-32 h-32 flex-shrink-0 bg-surface rounded-2xl overflow-hidden border border-on-surface/5">
                    <img src={s.imageUrl} className="w-full h-full object-cover grayscale brightness-90 group-hover:grayscale-0 group-hover:scale-110 transition-all duration-700" />
                  </div>
                  <div className="flex-1 flex flex-col justify-between">
                    <div>
                      <div className="flex justify-between items-start mb-2">
                        <h3 className="heading-bold text-3xl leading-[0.8] uppercase">{s.name}</h3>
                        <span className="text-xl font-black italic text-cyan-400">#{s.rating}</span>
                      </div>
                      <p className="label-mono opacity-40 text-[9px] mb-4">{s.location} // {s.distance}</p>
                    </div>
                    <div className="flex items-center justify-between border-t border-on-surface/5 pt-4">
                       <span className="label-mono !text-[8px] bg-on-surface/5 px-2 py-1">{s.price}</span>
                       <ArrowRight size={18} className="opacity-0 translate-x-[-10px] group-hover:opacity-100 group-hover:translate-x-0 transition-all text-cyan-400" />
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="map"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="w-full rounded-3xl overflow-hidden border border-on-surface/10 shadow-2xl"
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
  const [locationName, setLocationName] = useState<string>('MENYINGKRONKAN...');
  const [shareStatus, setShareStatus] = useState<string | null>(null);

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
    if (!("geolocation" in navigator)) return;

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const coords = {
          lat: position.coords.latitude,
          lng: position.coords.longitude
        };
        setUserLocation(coords);
        
        // Reverse geocoding for UI display
        fetch(`https://maps.googleapis.com/maps/api/geocode/json?latlng=${coords.lat},${coords.lng}&key=${MAP_KEY}`)
          .then(res => res.json())
          .then(data => {
            if (data.results && data.results.length > 0) {
              const cityComponent = data.results[0].address_components.find(
                (c: any) => c.types.includes('locality') || c.types.includes('administrative_area_level_2')
              );
              const city = cityComponent?.long_name || 'TITIK_AKTIF';
              setLocationName(`${city.toUpperCase()}.OS`);
            } else {
              setLocationName('GRID_AKTIF.OS');
            }
          })
          .catch(() => setLocationName('GRID_LOCATED'));
      },
      (error) => {
        console.warn("Geolocation access denied", error);
        if (error.code === 1) {
          setLocationName('IZIN_DITOLAK');
        }
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

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
            className="fixed bottom-24 sm:bottom-12 left-1/2 -translate-x-1/2 z-[100] bg-on-surface text-surface px-8 py-3 label-mono font-black italic shadow-2xl skew-x-[-12deg]"
          >
            {shareStatus === 'LINK_DISALIN' ? '📋 LINK_DISALIN' : '✅ BERHASIL_DIBAGIKAN'}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="min-h-screen bg-surface font-sans text-on-surface select-none">
        {!userLocation && (
          <div className="fixed inset-0 z-[100] bg-surface flex flex-col items-center justify-center space-y-8">
            <motion.div 
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
              className="w-20 h-20 border-t-2 border-cyan-400 rounded-full shadow-[0_0_20px_rgba(34,211,238,0.5)]"
            />
            <div className="text-center space-y-2">
              <h1 className="heading-bold text-2xl tracking-[0.3em]">MENCARI_SINYAL_GPS</h1>
              <p className="label-mono opacity-40">HARAP_BERIKAN_IZIN_LOKASI_UNTUK_SINKRONISASI_GRID</p>
            </div>
          </div>
        )}
        
        {currentPage !== 'detail' && <TopAppBar />}
        
        <main className="relative">
          <AnimatePresence mode="wait">
            {currentPage === 'radar' && <HomePage spots={spots} userLocation={userLocation} locationName={locationName} onSelectSpot={handleSelectSpot} />}
            {currentPage === 'spots' && (
               <SpotsPage spots={spots} userLocation={userLocation} onSelectSpot={handleSelectSpot} />
            )}
            {currentPage === 'ai-finder' && <AIFinderPage spots={spots} userLocation={userLocation} locationName={locationName} onSelectSpot={handleSelectSpot} />}
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
              />
            )}
          </AnimatePresence>
        </main>

        <AnimatePresence>
          {shareStatus && (
            <motion.div
              initial={{ y: 100, opacity: 0, x: '-50%' }}
              animate={{ y: 0, opacity: 1, x: '-50%' }}
              exit={{ y: 100, opacity: 0, x: '-50%' }}
              className="fixed bottom-24 left-1/2 z-[100] bg-on-surface text-surface px-6 py-3 label-mono !text-[10px] font-black border border-surface/20 shadow-2xl skew-x-[-10deg]"
            >
              {shareStatus}
            </motion.div>
          )}
        </AnimatePresence>

        {currentPage !== 'detail' && (
          <BottomNavBar activePage={currentPage} setActivePage={setCurrentPage} />
        )}

        {/* Global Background Map Overlay Effect */}
        <div className="fixed inset-0 -z-10 opacity-10 pointer-events-none select-none">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_transparent_0%,_#161311_80%)]" />
          <img 
            src="https://lh3.googleusercontent.com/aida-public/AB6AXuAtxHT47w-lOX2vQROpZ2gAzvMGUFw6-P2PcpcRfsi8X19mG8SczTCLWTpTJ8ptVKxpgsbf5bCzC-CUsZkcccwM1Z0l7w2M6qUpE_fJ8u865i1Bik428p57URHQHaNwhXpfxXp7Qr5a81aKTmKcGBfMr-0Rjw8ZvuIH_KynF1v54GxCCX-AoHpGjjuGcPi_0h12qeEWGvZMfB2yP08VNAIM6A7nAC2anKxI15e89QqII7WyiBMBnWiqDmsRkAxmgbzJsJwOtpzxA_Z8" 
            className="w-full h-full object-cover grayscale brightness-50" 
            alt="Background Map"
          />
        </div>
      </div>
    </APIProvider>
  );
}
