import BusTracker from "./components/BusMapComponents/BusTracker"
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Driver from "./pages/Driver"
import UserPage from "./components/userComponents/UserPage";

function App() {

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Driver />} />
        <Route path="/track" element={<UserPage />} />
        <Route path="/tracker/:tripId" element={<BusTracker />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App
