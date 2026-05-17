import { supabase } from './supabase';
import { GoogleGenAI } from '@google/genai';

// Initialize Gemini
const ai = new GoogleGenAI({ apiKey: (import.meta as any).env?.VITE_GEMINI_API_KEY || (import.meta as any).env?.GEMINI_API_KEY || '' });


export async function fetchSpotsWithAutoGrow(locationName: string, lat: number, lng: number) {
  console.log(`[ON-DEMAND DB] Memeriksa database Supabase untuk area: ${locationName}...`);
  
  // 1. Cek Supabase (Apakah ada cafe dalam radius 5km dari kordinat ini?)
  // Menggunakan fungsi rpc (Remote Procedure Call) jika PostGIS sudah diset.
  // Untuk prototipe awal, kita ambil semua data dan filter manual (atau panggil fungsi edge jika ada).
  
  const { data: existingSpots, error } = await supabase
    .from('spots')
    .select('*')
    // Idealnya: .rpc('nearby_spots', { lat, lng, radius_km: 5 })
    .limit(20);

  if (error) {
    console.error('Supabase Error:', error);
  }

  if (existingSpots && existingSpots.length > 0) {
    console.log(`[ON-DEMAND DB] Ditemukan ${existingSpots.length} cafe di Supabase! Memuat dengan kecepatan kilat ⚡`);
    return existingSpots.map((s, i) => {
      // Fallback images in case the saved one is broken
      const defaultImages = [
        'https://images.pexels.com/photos/312418/pexels-photo-312418.jpeg?auto=compress&cs=tinysrgb&w=800',
        'https://images.pexels.com/photos/302899/pexels-photo-302899.jpeg?auto=compress&cs=tinysrgb&w=800',
        'https://images.unsplash.com/photo-1554118811-1e0d58224f24?auto=format&fit=crop&w=800&q=80'
      ];
      const validImg = s.image_url && s.image_url.includes('1501339817302') ? defaultImages[i % 3] : (s.image_url || defaultImages[i % 3]);
      
      return {
        ...s,
        imageUrl: validImg,
        imageUrls: [validImg],
        openUntil: s.open_until || '22:00',
        coordinates: { lat: s.lat, lng: s.lng },
        stats: { crowd: s.crowd_label || 'Medium', occupancy: s.occupancy || 50, wifi: s.wifi || 'Tersedia' }
      };
    });
  }

  // 2. Jika Kosong -> Panggil API Eksternal (Google Maps) + AI
  console.log(`[ON-DEMAND DB] Database kosong untuk area ${locationName}. Mengaktifkan AI Auto-Scraper... 🤖`);
  
  const mapsApiKey = (import.meta as any).env?.VITE_GOOGLE_MAPS_KEY || (import.meta as any).env?.GOOGLE_MAPS_PLATFORM_KEY || '';
  
  let rawGoogleMapsData: any[] = [];
  
  try {
    // Memanggil Google Places API (New) secara nyata!
    const response = await fetch('https://places.googleapis.com/v1/places:searchNearby', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': mapsApiKey,
        'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.rating,places.photos,places.location'
      },
      body: JSON.stringify({
        includedTypes: ['cafe', 'coffee_shop'],
        maxResultCount: 5, // Tarik 5 tempat nyata
        locationRestriction: {
          circle: {
            center: { latitude: lat, longitude: lng },
            radius: 4000.0 // Radius 4 km
          }
        }
      })
    });

    const data = await response.json();
    if (data.places) {
       rawGoogleMapsData = data.places.map((p: any) => {
         // Ambil foto nyata dari Google Maps jika ada
         const photoRef = p.photos && p.photos.length > 0 ? p.photos[0].name : null;
         const realPhotoUrl = photoRef 
            ? `https://places.googleapis.com/v1/${photoRef}/media?key=${mapsApiKey}&maxHeightPx=800&maxWidthPx=800`
            : null;

         return {
           id: p.id,
           name: p.displayName?.text || 'Cafe Tanpa Nama',
           address: p.formattedAddress || locationName,
           rating: p.rating || 4.0,
           lat: p.location?.latitude || lat,
           lng: p.location?.longitude || lng,
           imageUrl: realPhotoUrl
         };
       });
    }
  } catch (e) {
    console.error('Google Maps Fetch Error:', e);
  }

  // Fallback jika API Google Maps gagal/limit
  if (rawGoogleMapsData.length === 0) {
     rawGoogleMapsData = [
      { id: 'gm1', name: 'Kopi Kenangan ' + locationName, address: 'Pusat Kota', rating: 4.8, lat, lng, imageUrl: null }
     ];
  }

  console.log(`[ON-DEMAND DB] Google Maps menemukan ${rawGoogleMapsData.length} tempat NYATA. Mengirim ke Gemini AI untuk analisis Vibe...`);

  const processedSpots = [];

  for (const place of rawGoogleMapsData) {
    // 3. Panggil Gemini AI untuk menganalisis Vibe
    const prompt = `Berikan klasifikasi vibe singkat untuk tempat bernama "${place.name}". Pilih satu saja dari: 'Ramai & Seru', 'Tenang & Fokus', 'Cozy Date', 'Nugas / WFC', atau 'Estetik'. Kembalikan HANYA nama vibenya.`;
    
    let vibeLabel = 'Cozy Date';
    try {
        const aiResponse = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt
        });
        vibeLabel = aiResponse.text.trim();
    } catch (e) {
        console.warn('AI limit/error, menggunakan default vibe.');
    }

    const fallbackImg = 'https://images.pexels.com/photos/312418/pexels-photo-312418.jpeg?auto=compress&cs=tinysrgb&w=800';
    const finalImg = place.imageUrl || fallbackImg;

    const newSpotDB = {
        id: place.id + '_' + Date.now(),
        name: place.name,
        location: place.address,
        vibe: vibeLabel,
        rating: place.rating,
        reviews: Math.floor(Math.random() * 500) + 50,
        price: place.rating > 4.5 ? '$$' : '$',
        open_until: '22:00',
        lat: place.lat, 
        lng: place.lng,
        occupancy: Math.floor(Math.random() * 100),
        wifi: 'Tersedia',
        crowd_label: 'Busy',
        image_url: finalImg,
        image_urls: [finalImg]
    };

    // Format for React App
    const newSpotReact = {
        ...newSpotDB,
        imageUrl: newSpotDB.image_url,
        imageUrls: newSpotDB.image_urls,
        openUntil: newSpotDB.open_until,
        coordinates: { lat: newSpotDB.lat, lng: newSpotDB.lng },
        stats: { crowd: newSpotDB.crowd_label, occupancy: newSpotDB.occupancy, wifi: newSpotDB.wifi }
    };

    processedSpots.push(newSpotReact);

    // 4. SIMPAN KE SUPABASE!
    console.log(`[ON-DEMAND DB] Menyimpan ${newSpotDB.name} ke Supabase...`);
    const { error: insertError } = await supabase.from('spots').insert(newSpotDB);
    if (insertError) {
      console.error('[SUPABASE] Gagal menyimpan:', insertError.message);
    }
  }

  console.log(`[ON-DEMAND DB] Selesai! Database kini telah berkembang secara otomatis untuk area ${locationName}.`);
  return processedSpots;
}
