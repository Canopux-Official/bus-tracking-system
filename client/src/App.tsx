import BusTracker from "./components/BusMapComponents/BusTracker"
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Driver from "./pages/Driver"

function App() {

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Driver />} />
        <Route path="/tracker" element={<BusTracker />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App
