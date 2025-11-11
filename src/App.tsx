import { Routes, Route } from 'react-router-dom';
import { WelcomeScreen } from './screens/Welcome';
import { ScheduleScreen } from './screens/Schedule';
import './App.css';

function App() {
  return (
    <Routes>
      <Route path="/" element={<WelcomeScreen />} />
      <Route path="/schedule" element={<ScheduleScreen />} />
    </Routes>
  );
}

export default App;