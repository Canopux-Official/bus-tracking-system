// // Backend URL.
// const BASE_URL = "http://localhost:4000";


// // Helper function for fetch.
// const apiRequest = async (endpoint: string, options: RequestInit) => {
//   try {
//     const res = await fetch(`${BASE_URL}${endpoint}`, {
//       headers: {
//         "Content-Type": "application/json",
//       },
//       ...options,
//     });

//     if (!res.ok) {
//       const errorText = await res.text();
//       throw new Error(errorText || "API request failed");
//     }

//     return await res.json();
//   } catch (err) {
//     console.error("API ERROR:", err);
//     throw err;
//   }
// };



// // 1. Start Trip (Returns tripId).
// export const startTrip = async (data: {
//   busId: string;
//   source: string;
//   destination: string;
// }) => {
//   return apiRequest("/start-trip", {
//     method: "POST",
//     body: JSON.stringify(data),
//   });
// };



// // 2. Send Live Location.
// export const sendLiveLocation = async (data: {
//   tripId: string;        
//   lat: number;
//   lng: number;
//   velocity: number;
//   acceleration: number;
// }) => {
//   return apiRequest("/live-location", {
//     method: "POST",
//     body: JSON.stringify(data),
//   });
// };



// // 3. End Trip.
// export const endTrip = async (tripId: string) => {
//   return apiRequest("/end-trip", {
//     method: "POST",
//     body: JSON.stringify({ tripId }),
//   });
// };




// Fake delay to simulate network
const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

// In-memory mock DB
let mockTripId = "trip_" + Math.floor(Math.random() * 10000);
let isTripActive = false;


// 1. Start Trip (Mock)
export const startTrip = async (data: {
  busId: string;
  source: string;
  destination: string;
}) => {
  console.log("📡 MOCK API: startTrip", data);

  await delay(800); // simulate API delay

  isTripActive = true;
  mockTripId = "trip_" + Math.floor(Math.random() * 10000);

  return {
    success: true,
    tripId: mockTripId,
    message: "Trip started successfully",
  };
};


// 2. Send Live Location (Mock)
export const sendLiveLocation = async (data: {
  tripId: string;
  lat: number;
  lng: number;
  velocity: number;
  acceleration: number;
}) => {
  console.log("📡 MOCK API: liveLocation", data);

  await delay(500);

  if (!isTripActive) {
    throw new Error("Trip not active");
  }

  return {
    success: true,
    message: "Location updated",
  };
};


// 3. End Trip (Mock)
export const endTrip = async (tripId: string) => {
  console.log("📡 MOCK API: endTrip", tripId);

  await delay(700);

  if (!isTripActive) {
    throw new Error("No active trip");
  }

  isTripActive = false;

  return {
    success: true,
    message: "Trip ended successfully",
  };
};