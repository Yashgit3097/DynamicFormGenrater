import { HashRouter, Routes, Route } from "react-router-dom";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import UserForm from "./pages/UserForm";
import ProtectedRoute from "./components/ProtectedRoute";
import InstallPWA from "./components/InstallPWA";

export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/form/:eventId" element={<UserForm />} />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />
      </Routes>
      <InstallPWA />
    </HashRouter>
  );
}